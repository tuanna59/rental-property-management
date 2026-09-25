import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

import type { SpaceTypeValue } from "../domain/types";
import {
  assertActiveRecord,
  assertCanArchiveFloor,
  assertCanDeleteFloor,
  assertSpaceBelongsToFloor,
  moveOrderedId,
  nextSortOrder,
} from "../domain/rules";

async function orderedTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      const prismaConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      const adapterConflict =
        error instanceof Error &&
        error.name === "DriverAdapterError" &&
        (error as Error & { cause?: { kind?: string } }).cause?.kind ===
          "TransactionWriteConflict";
      if ((!prismaConflict && !adapterConflict) || attempt >= 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 15));
    }
  }
}

export async function updateProperty(input: {
  propertyId: string;
  name: string;
  addressLine1?: string;
  city?: string;
  country?: string;
  description?: string;
}) {
  await prisma.property.update({
    where: { id: input.propertyId, archivedAt: null },
    data: {
      name: input.name,
      addressLine1: input.addressLine1 ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      description: input.description ?? null,
    },
  });
}

export async function createFloor(input: {
  propertyId: string;
  name: string;
  level?: number;
  notes?: string;
}) {
  await orderedTransaction(async (tx) => {
    const property = await tx.property.findFirst({
      where: { id: input.propertyId, archivedAt: null },
      select: { id: true },
    });
    assertActiveRecord(property, "The selected property was not found.");

    const floors = await tx.floor.findMany({
      where: { propertyId: input.propertyId, archivedAt: null },
      select: { id: true, sortOrder: true },
    });

    await tx.floor.create({
      data: {
        propertyId: input.propertyId,
        name: input.name,
        level: input.level,
        notes: input.notes,
        sortOrder: nextSortOrder(floors),
      },
    });
  });
}

export async function updateFloor(input: {
  floorId: string;
  name: string;
  level?: number;
  notes?: string;
}) {
  await prisma.floor.update({
    where: {
      id: input.floorId,
      archivedAt: null,
      property: { archivedAt: null },
    },
    data: {
      name: input.name,
      level: input.level ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function reorderFloor(input: {
  propertyId: string;
  floorId: string;
  direction: "up" | "down";
}) {
  await orderedTransaction(async (tx) => {
    const floors = await tx.floor.findMany({
      where: {
        propertyId: input.propertyId,
        archivedAt: null,
        property: { archivedAt: null },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const reorderedIds = moveOrderedId(
      floors.map((floor) => floor.id),
      input.floorId,
      input.direction,
    );

    await Promise.all(
      reorderedIds.map((id, index) =>
        tx.floor.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  });
}

export async function archiveFloor(input: { floorId: string }) {
  await orderedTransaction(async (tx) => {
    const activeSpaceCount = await tx.space.count({
      where: { floorId: input.floorId, archivedAt: null },
    });
    assertCanArchiveFloor(activeSpaceCount);

    await tx.floor.update({
      where: { id: input.floorId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  });
}

export async function deleteFloor(input: { floorId: string }) {
  await orderedTransaction(async (tx) => {
    const spaceCount = await tx.space.count({
      where: { floorId: input.floorId },
    });
    assertCanDeleteFloor(spaceCount);

    await tx.floor.delete({
      where: { id: input.floorId },
    });
  });
}

export async function createSpace(input: {
  floorId: string;
  name: string;
  type: SpaceTypeValue;
  notes?: string;
}) {
  await orderedTransaction(async (tx) => {
    const floor = await tx.floor.findFirst({
      where: {
        id: input.floorId,
        archivedAt: null,
        property: { archivedAt: null },
      },
      select: { id: true },
    });
    assertActiveRecord(floor, "The selected floor was not found.");

    const spaces = await tx.space.findMany({
      where: { floorId: input.floorId, archivedAt: null },
      select: { id: true, sortOrder: true },
    });

    await tx.space.create({
      data: {
        floorId: input.floorId,
        name: input.name,
        type: input.type,
        notes: input.notes,
        sortOrder: nextSortOrder(spaces),
      },
    });
  });
}

export async function updateSpace(input: {
  spaceId: string;
  name: string;
  type: SpaceTypeValue;
  notes?: string;
}) {
  await prisma.space.update({
    where: {
      id: input.spaceId,
      archivedAt: null,
      floor: { archivedAt: null, property: { archivedAt: null } },
    },
    data: {
      name: input.name,
      type: input.type,
      notes: input.notes ?? null,
    },
  });
}

export async function reorderSpace(input: {
  floorId: string;
  spaceId: string;
  direction: "up" | "down";
}) {
  await orderedTransaction(async (tx) => {
    const space = await tx.space.findFirst({
      where: {
        id: input.spaceId,
        archivedAt: null,
        floor: { archivedAt: null, property: { archivedAt: null } },
      },
      select: { floorId: true },
    });
    assertActiveRecord(space, "The selected space was not found.");
    assertSpaceBelongsToFloor(space.floorId, input.floorId);

    const spaces = await tx.space.findMany({
      where: { floorId: input.floorId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const reorderedIds = moveOrderedId(
      spaces.map((item) => item.id),
      input.spaceId,
      input.direction,
    );

    await Promise.all(
      reorderedIds.map((id, index) =>
        tx.space.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  });
}

export async function archiveSpace(input: { spaceId: string }) {
  await prisma.space.update({
    where: { id: input.spaceId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
}

export async function deleteSpace(input: { spaceId: string }) {
  await prisma.space.delete({
    where: { id: input.spaceId },
  });
}
