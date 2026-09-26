import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";
import { TenancyDomainError } from "../src/modules/tenancy/domain/errors";
import type { MoveInInput } from "../src/modules/tenancy/domain/types";
import {
  countActiveOccupantsForTenancy,
  getActiveOccupantsForTenancy,
  getCurrentOccupancyBySpaceIds,
  getCurrentResponsiblePerson,
  getCurrentTenancyForSpace,
} from "../src/modules/tenancy/server/queries";
import {
  addAdditionalOccupant,
  cancelScheduledMoveOut,
  cancelUpcomingMoveIn,
  endAdditionalOccupancy,
  moveAdditionalOccupant,
  moveIn,
  moveOut,
} from "../src/modules/tenancy/server/services";

const fixturePrefix = "Phase 2A.3 Fictional";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const spaces = new Map<string, string>();
let personSequence = 0;

async function removeFixtures() {
  await prisma.tenancyOccupant.deleteMany({
    where: {
      tenancy: { space: { floor: { property: { name: fixturePrefix } } } },
    },
  });
  await prisma.tenancy.deleteMany({
    where: { space: { floor: { property: { name: fixturePrefix } } } },
  });
  await prisma.space.deleteMany({
    where: { floor: { property: { name: fixturePrefix } } },
  });
  await prisma.floor.deleteMany({
    where: { property: { name: fixturePrefix } },
  });
  await prisma.property.deleteMany({ where: { name: fixturePrefix } });
  await prisma.person.deleteMany({
    where: { fullName: { startsWith: fixturePrefix } },
  });
}

async function createPerson(options?: { archived?: boolean }) {
  personSequence += 1;
  return prisma.person.create({
    data: {
      fullName: `${fixturePrefix} Person ${personSequence}`,
      archivedAt: options?.archived ? new Date() : null,
    },
  });
}

function moveInInput(
  space: string,
  personId: string,
  overrides: Partial<MoveInInput> = {},
): MoveInInput {
  return {
    spaceId: spaces.get(space)!,
    moveInDate: "2026-09-01",
    moveOutDate: "2026-10-01",
    monthlyRentVnd: "3500000",
    occupants: [
      {
        personId,
        role: "RESPONSIBLE",
        startDate: "2026-09-01",
        endDate: "2026-10-01",
      },
    ],
    ...overrides,
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: TenancyDomainError["code"],
) {
  try {
    await promise;
    throw new Error("Expected a tenancy domain error.");
  } catch (error) {
    expect(error).toBeInstanceOf(TenancyDomainError);
    expect((error as TenancyDomainError).code).toBe(code);
  }
}

beforeAll(async () => {
  await removeFixtures();
  const roomNames = [
    "valid",
    "archived",
    "rules",
    "overlap-sequential",
    "overlap-concurrent",
    "person-one",
    "person-two",
    "person-three",
    "person-four",
    "move-out",
    "move-out-invalid",
    "occupancy",
    "counts",
    "responsible",
    "lifecycle-a",
    "lifecycle-b",
    "cancel-move-out",
  ];
  const property = await prisma.property.create({
    data: {
      name: fixturePrefix,
      floors: {
        create: {
          name: "Service floor",
          sortOrder: 1,
          spaces: {
            create: [
              ...roomNames.map((name, index) => ({
                name,
                type: "ROOM" as const,
                sortOrder: index + 1,
                archivedAt: name === "archived" ? new Date() : null,
              })),
              {
                name: "garage",
                type: "GARAGE" as const,
                sortOrder: roomNames.length + 1,
              },
            ],
          },
        },
      },
    },
    include: { floors: { include: { spaces: true } } },
  });
  for (const space of property.floors[0].spaces) {
    spaces.set(space.name, space.id);
  }
});

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

describe.sequential("tenancy services", () => {
  it("creates one-person, multi-occupant, and future tenancies atomically", async () => {
    const responsible = await createPerson();
    const additional = await createPerson();
    const tenancy = await moveIn(
      moveInInput("valid", responsible.id, {
        moveInDate: "2030-01-01",
        moveOutDate: "2030-12-01",
        depositVnd: BigInt(7_000_000),
        occupants: [
          {
            personId: responsible.id,
            role: "RESPONSIBLE",
            startDate: "2030-01-01",
            endDate: "2030-12-01",
          },
          {
            personId: additional.id,
            role: "ADDITIONAL",
            startDate: "2030-02-01",
            endDate: "2030-11-01",
          },
        ],
      }),
    );
    const stored = await prisma.tenancy.findUniqueOrThrow({
      where: { id: tenancy.id },
      include: { occupants: true },
    });
    expect(stored.depositVnd).toBe(BigInt(7_000_000));
    expect(stored.occupants).toHaveLength(2);
  });

  it("rejects missing, archived, and ineligible references", async () => {
    const active = await createPerson();
    const archived = await createPerson({ archived: true });
    await expectCode(
      moveIn(moveInInput("rules", "missing-person")),
      "PERSON_NOT_FOUND",
    );
    await expectCode(
      moveIn(moveInInput("rules", archived.id)),
      "PERSON_ARCHIVED",
    );
    await expectCode(
      moveIn(moveInInput("garage", active.id)),
      "SPACE_NOT_ELIGIBLE",
    );
    await expectCode(
      moveIn(moveInInput("archived", active.id)),
      "SPACE_NOT_FOUND",
    );
  });

  it("rejects invalid initial occupant configurations before writing", async () => {
    const first = await createPerson();
    const second = await createPerson();
    const base = moveInInput("rules", first.id);

    await expectCode(
      moveIn({
        ...base,
        occupants: [{ ...base.occupants[0], role: "ADDITIONAL" }],
      }),
      "INVALID_RESPONSIBLE_CONFIGURATION",
    );
    await expectCode(
      moveIn({
        ...base,
        occupants: [
          base.occupants[0],
          { ...base.occupants[0], personId: second.id },
        ],
      }),
      "INVALID_RESPONSIBLE_CONFIGURATION",
    );
    await expectCode(
      moveIn({
        ...base,
        occupants: [{ ...base.occupants[0], startDate: "2026-09-02" }],
      }),
      "INVALID_RESPONSIBLE_CONFIGURATION",
    );
    await expectCode(
      moveIn({
        ...base,
        occupants: [
          base.occupants[0],
          {
            personId: second.id,
            role: "ADDITIONAL",
            startDate: "2026-08-31",
            endDate: "2026-10-01",
          },
        ],
      }),
      "INVALID_MEMBERSHIP_DATES",
    );
    await expectCode(
      moveIn({
        ...base,
        occupants: [base.occupants[0], { ...base.occupants[0] }],
      }),
      "DUPLICATE_OCCUPANT",
    );
    expect(
      await prisma.tenancy.count({ where: { spaceId: spaces.get("rules")! } }),
    ).toBe(0);
  });

  it("returns a stable error for sequential room overlap", async () => {
    const first = await createPerson();
    const second = await createPerson();
    await moveIn(moveInInput("overlap-sequential", first.id));
    await expectCode(
      moveIn(
        moveInInput("overlap-sequential", second.id, {
          moveInDate: "2026-09-15",
          moveOutDate: "2026-10-15",
          occupants: [
            {
              personId: second.id,
              role: "RESPONSIBLE",
              startDate: "2026-09-15",
              endDate: "2026-10-15",
            },
          ],
        }),
      ),
      "TENANCY_OVERLAP",
    );
  });

  it("allows only one concurrent tenancy for the same room", async () => {
    const first = await createPerson();
    const second = await createPerson();
    const results = await Promise.allSettled([
      moveIn(moveInInput("overlap-concurrent", first.id)),
      moveIn(moveInInput("overlap-concurrent", second.id)),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      code: "TENANCY_OVERLAP",
    });
  });

  it("rejects cross-room person overlap and accepts adjacent occupancy", async () => {
    const person = await createPerson();
    await moveIn(moveInInput("person-one", person.id));
    await expectCode(
      moveIn(
        moveInInput("person-two", person.id, {
          moveInDate: "2026-09-15",
          moveOutDate: "2026-10-15",
          occupants: [
            {
              personId: person.id,
              role: "RESPONSIBLE",
              startDate: "2026-09-15",
              endDate: "2026-10-15",
            },
          ],
        }),
      ),
      "PERSON_OCCUPANCY_OVERLAP",
    );
    await expect(
      moveIn(
        moveInInput("person-two", person.id, {
          moveInDate: "2026-10-01",
          moveOutDate: "2026-11-01",
          occupants: [
            {
              personId: person.id,
              role: "RESPONSIBLE",
              startDate: "2026-10-01",
              endDate: "2026-11-01",
            },
          ],
        }),
      ),
    ).resolves.toBeDefined();
  });

  it("serializes concurrent cross-room move-ins for the same person", async () => {
    const person = await createPerson();
    const results = await Promise.allSettled([
      moveIn(moveInInput("person-three", person.id)),
      moveIn(moveInInput("person-four", person.id)),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      code: "PERSON_OCCUPANCY_OVERLAP",
    });
  });

  it("moves out atomically without extending earlier membership history", async () => {
    const responsible = await createPerson();
    const additional = await createPerson();
    const tenancy = await moveIn(
      moveInInput("move-out", responsible.id, {
        moveOutDate: null,
        occupants: [
          {
            personId: responsible.id,
            role: "RESPONSIBLE",
            startDate: "2026-09-01",
          },
          {
            personId: additional.id,
            role: "ADDITIONAL",
            startDate: "2026-09-01",
            endDate: "2026-09-15",
          },
        ],
      }),
    );
    await moveOut({
      tenancyId: tenancy.id,
      moveOutDate: "2027-01-01",
      moveOutNotes: "Future departure recorded.",
    });
    const stored = await prisma.tenancy.findUniqueOrThrow({
      where: { id: tenancy.id },
      include: { occupants: { orderBy: { endDate: "desc" } } },
    });
    expect(stored.moveOutDate).toEqual(day("2027-01-01"));
    expect(stored.occupants.map((occupant) => occupant.endDate)).toEqual([
      day("2027-01-01"),
      day("2026-09-15"),
    ]);
    await expectCode(
      moveOut({ tenancyId: tenancy.id, moveOutDate: "2027-02-01" }),
      "TENANCY_ALREADY_CLOSED",
    );
  });

  it("rejects invalid move-out dates", async () => {
    const person = await createPerson();
    const tenancy = await moveIn(
      moveInInput("move-out-invalid", person.id, { moveOutDate: null }),
    );
    await expectCode(
      moveOut({ tenancyId: tenancy.id, moveOutDate: "2026-09-01" }),
      "INVALID_TENANCY_DATES",
    );
    await expectCode(
      moveOut({ tenancyId: "missing-tenancy", moveOutDate: "2026-10-01" }),
      "TENANCY_NOT_FOUND",
    );
  });

  it("derives occupancy with half-open date semantics", async () => {
    const person = await createPerson();
    const tenancy = await moveIn(moveInInput("occupancy", person.id));
    expect(
      await getCurrentTenancyForSpace(spaces.get("occupancy")!, "2026-08-31"),
    ).toBeNull();
    expect(
      await getCurrentTenancyForSpace(spaces.get("occupancy")!, "2026-09-01"),
    ).toMatchObject({ tenancyId: tenancy.id, occupantCount: 1 });
    expect(
      await getCurrentTenancyForSpace(spaces.get("occupancy")!, "2026-09-30"),
    ).toMatchObject({ tenancyId: tenancy.id, occupantCount: 1 });
    expect(
      await getCurrentTenancyForSpace(spaces.get("occupancy")!, "2026-10-01"),
    ).toBeNull();
    const batch = await getCurrentOccupancyBySpaceIds(
      [spaces.get("occupancy")!, spaces.get("counts")!],
      "2026-09-10",
    );
    expect([...batch.keys()]).toEqual([spaces.get("occupancy")!]);
  });

  it("counts dated occupants and resolves adjacent responsible history", async () => {
    const responsible = await createPerson();
    const ending = await createPerson();
    const future = await createPerson();
    const countTenancy = await moveIn(
      moveInInput("counts", responsible.id, {
        moveOutDate: null,
        occupants: [
          {
            personId: responsible.id,
            role: "RESPONSIBLE",
            startDate: "2026-09-01",
          },
          {
            personId: ending.id,
            role: "ADDITIONAL",
            startDate: "2026-09-01",
            endDate: "2026-09-20",
          },
          {
            personId: future.id,
            role: "ADDITIONAL",
            startDate: "2026-09-10",
          },
        ],
      }),
    );
    expect(
      await countActiveOccupantsForTenancy(countTenancy.id, "2026-09-01"),
    ).toBe(2);
    expect(
      await getActiveOccupantsForTenancy(countTenancy.id, "2026-09-10"),
    ).toHaveLength(3);
    expect(
      await countActiveOccupantsForTenancy(countTenancy.id, "2026-09-20"),
    ).toBe(2);

    const firstResponsible = await createPerson();
    const nextResponsible = await createPerson();
    const responsibilityTenancy = await moveIn(
      moveInInput("responsible", firstResponsible.id, {
        moveOutDate: null,
        occupants: [
          {
            personId: firstResponsible.id,
            role: "RESPONSIBLE",
            startDate: "2026-09-01",
            endDate: "2026-10-01",
          },
        ],
      }),
    );
    await prisma.tenancyOccupant.create({
      data: {
        tenancyId: responsibilityTenancy.id,
        personId: nextResponsible.id,
        role: "RESPONSIBLE",
        startDate: day("2026-10-01"),
      },
    });
    expect(
      await getCurrentResponsiblePerson(responsibilityTenancy.id, "2026-09-30"),
    ).toMatchObject({ personId: firstResponsible.id });
    expect(
      await getCurrentResponsiblePerson(responsibilityTenancy.id, "2026-10-01"),
    ).toMatchObject({ personId: nextResponsible.id });
  });

  it("preserves adjacent history when an additional occupant changes rooms", async () => {
    const responsibleA = await createPerson();
    const responsibleB = await createPerson();
    const additional = await createPerson();
    const tenancyA = await moveIn(
      moveInInput("lifecycle-a", responsibleA.id, { moveOutDate: null }),
    );
    await moveIn(
      moveInInput("lifecycle-b", responsibleB.id, { moveOutDate: null }),
    );
    const membership = await addAdditionalOccupant({
      tenancyId: tenancyA.id,
      personId: additional.id,
      startDate: "2026-09-10",
    });
    const moved = await moveAdditionalOccupant({
      membershipId: membership.id,
      destinationSpaceId: spaces.get("lifecycle-b")!,
      effectiveDate: "2026-09-20",
    });
    await endAdditionalOccupancy({
      membershipId: moved.id,
      endDate: "2026-09-25",
      notes: "Synthetic acceptance exit",
    });

    const history = await prisma.tenancyOccupant.findMany({
      where: { personId: additional.id },
      orderBy: { startDate: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(
      history.map(({ startDate, endDate }) => [startDate, endDate]),
    ).toEqual([
      [day("2026-09-10"), day("2026-09-20")],
      [day("2026-09-20"), day("2026-09-25")],
    ]);
  });

  it("rejects conflicting move-out cancellation and reopens only move-out closures", async () => {
    const responsible = await createPerson();
    const formerAdditional = await createPerson();
    const futureResponsible = await createPerson();
    const tenancy = await moveIn(
      moveInInput("cancel-move-out", responsible.id, {
        moveOutDate: null,
        occupants: [
          {
            personId: responsible.id,
            role: "RESPONSIBLE",
            startDate: "2026-09-01",
          },
          {
            personId: formerAdditional.id,
            role: "ADDITIONAL",
            startDate: "2026-09-01",
            endDate: "2026-09-20",
          },
        ],
      }),
    );
    await moveOut({ tenancyId: tenancy.id, moveOutDate: "2026-10-01" });
    const future = await moveIn(
      moveInInput("cancel-move-out", futureResponsible.id, {
        moveInDate: "2026-10-01",
        moveOutDate: null,
        occupants: [
          {
            personId: futureResponsible.id,
            role: "RESPONSIBLE",
            startDate: "2026-10-01",
          },
        ],
      }),
    );

    await expectCode(
      cancelScheduledMoveOut(tenancy.id, day("2026-09-25")),
      "TENANCY_OVERLAP",
    );
    await cancelUpcomingMoveIn(future.id, day("2026-09-25"));
    await cancelScheduledMoveOut(tenancy.id, day("2026-09-25"));

    const occupants = await prisma.tenancyOccupant.findMany({
      where: { tenancyId: tenancy.id },
      orderBy: { role: "asc" },
    });
    expect(
      occupants.find((item) => item.personId === responsible.id)?.endDate,
    ).toBeNull();
    expect(
      occupants.find((item) => item.personId === formerAdditional.id)?.endDate,
    ).toEqual(day("2026-09-20"));
  });
});
