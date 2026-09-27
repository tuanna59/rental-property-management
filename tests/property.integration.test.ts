import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import * as mutations from "../src/modules/property/server/property.service";

let propertyId: string;
let floorId: string;
let otherFloorId: string;
let spaceId: string;

beforeAll(async () => {
  const property = await prisma.property.create({
    data: { name: "Integration fixture" },
  });
  propertyId = property.id;
});
afterAll(async () => {
  if (propertyId) {
    await prisma.space.deleteMany({ where: { floor: { propertyId } } });
    await prisma.floor.deleteMany({ where: { propertyId } });
    await prisma.property.delete({ where: { id: propertyId } });
  }
  await prisma.$disconnect();
});

describe.sequential("persisted property operations", () => {
  it("edits property and clears optional fields", async () => {
    await mutations.updateProperty({
      propertyId,
      name: "Updated property",
      city: "City",
    });
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id: propertyId } }))
        .city,
    ).toBe("City");
    await mutations.updateProperty({ propertyId, name: "Updated property" });
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id: propertyId } }))
        .city,
    ).toBeNull();
  });
  it("creates and edits floors, clearing level and notes", async () => {
    await mutations.createFloor({
      propertyId,
      name: "First",
      level: 1,
      notes: "note",
    });
    await mutations.createFloor({ propertyId, name: "Second", level: 2 });
    const floors = await prisma.floor.findMany({
      where: { propertyId },
      orderBy: { sortOrder: "asc" },
    });
    [floorId, otherFloorId] = floors.map((f) => f.id);
    expect(floors.map((f) => f.sortOrder)).toEqual([1, 2]);
    await mutations.updateFloor({ floorId, name: "Renamed" });
    expect(
      await prisma.floor.findUniqueOrThrow({ where: { id: floorId } }),
    ).toMatchObject({ name: "Renamed", level: null, notes: null });
  });
  it("reorders floors only within their property", async () => {
    await expect(
      mutations.reorderFloor({
        propertyId: "missing",
        floorId,
        direction: "up",
      }),
    ).rejects.toThrow();
    await mutations.reorderFloor({ propertyId, floorId, direction: "down" });
    expect(
      (
        await prisma.floor.findMany({
          where: { propertyId },
          orderBy: { sortOrder: "asc" },
        })
      ).map((f) => f.id),
    ).toEqual([otherFloorId, floorId]);
  });
  it("creates, updates and reorders spaces, rejects invalid parents", async () => {
    await expect(
      mutations.createFloor({ propertyId: "missing", name: "Invalid" }),
    ).rejects.toThrow();
    await expect(
      mutations.createSpace({
        floorId: "missing",
        name: "Invalid",
        type: "ROOM",
      }),
    ).rejects.toThrow();
    await mutations.createSpace({
      floorId,
      name: "Alpha",
      type: "ROOM",
      notes: "note",
    });
    await mutations.createSpace({ floorId, name: "Beta", type: "STORAGE" });
    const spaces = await prisma.space.findMany({
      where: { floorId },
      orderBy: { sortOrder: "asc" },
    });
    spaceId = spaces[0].id;
    await mutations.updateSpace({
      spaceId,
      name: "Renamed space",
      type: "COMMON_AREA",
    });
    expect(
      await prisma.space.findUniqueOrThrow({ where: { id: spaceId } }),
    ).toMatchObject({
      name: "Renamed space",
      notes: null,
      type: "COMMON_AREA",
    });
    await expect(
      mutations.reorderSpace({
        spaceId,
        floorId: otherFloorId,
        direction: "down",
      }),
    ).rejects.toThrow("does not belong");
    await mutations.reorderSpace({ spaceId, floorId, direction: "down" });
    expect(
      (
        await prisma.space.findMany({
          where: { floorId },
          orderBy: { sortOrder: "asc" },
        })
      ).map((s) => s.id),
    ).toEqual([spaces[1].id, spaceId]);
  });
  it("protects nonempty floors and rejects creation under archived parents", async () => {
    await expect(mutations.archiveFloor({ floorId })).rejects.toThrow(
      "Archive or move",
    );
    await expect(mutations.deleteFloor({ floorId })).rejects.toThrow(
      "no spaces",
    );
    await mutations.archiveFloor({ floorId: otherFloorId });
    await expect(
      mutations.createSpace({
        floorId: otherFloorId,
        name: "Invalid",
        type: "ROOM",
      }),
    ).rejects.toThrow();
    await mutations.deleteFloor({ floorId: otherFloorId });
    expect(
      await prisma.floor.findUnique({ where: { id: otherFloorId } }),
    ).toBeNull();
  });
  it("archives spaces, prevents deletion of floors with archived children, and deletes safely", async () => {
    const spaces = await prisma.space.findMany({ where: { floorId } });
    for (const space of spaces)
      await mutations.archiveSpace({ spaceId: space.id });
    await expect(
      mutations.updateSpace({ spaceId, name: "Invalid", type: "ROOM" }),
    ).rejects.toThrow();
    await mutations.archiveFloor({ floorId });
    await expect(mutations.deleteFloor({ floorId })).rejects.toThrow();
    for (const space of spaces)
      await mutations.deleteSpace({ spaceId: space.id });
    await mutations.deleteFloor({ floorId });
    expect(
      await prisma.floor.findUnique({ where: { id: floorId } }),
    ).toBeNull();
  });
  it("serializes concurrent creates and archive/create races", async () => {
    await mutations.createFloor({ propertyId, name: "Concurrent" });
    const floor = await prisma.floor.findFirstOrThrow({
      where: { propertyId, name: "Concurrent" },
    });
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        mutations.createSpace({
          floorId: floor.id,
          name: "Concurrent " + i,
          type: "ROOM",
        }),
      ),
    );
    const spaces = await prisma.space.findMany({
      where: { floorId: floor.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(spaces.map((s) => s.sortOrder)).toEqual([1, 2, 3, 4]);
    await mutations.createFloor({ propertyId, name: "Race" });
    const race = await prisma.floor.findFirstOrThrow({
      where: { propertyId, name: "Race" },
    });
    await Promise.allSettled([
      mutations.archiveFloor({ floorId: race.id }),
      mutations.createSpace({
        floorId: race.id,
        name: "Race space",
        type: "ROOM",
      }),
    ]);
    const result = await prisma.floor.findUniqueOrThrow({
      where: { id: race.id },
      include: { spaces: true },
    });
    expect(
      result.archivedAt !== null && result.spaces.some((s) => !s.archivedAt),
    ).toBe(false);
  });
});
