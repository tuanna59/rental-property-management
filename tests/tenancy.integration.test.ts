import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";

const fixturePrefix = "Phase 2A.2 Fictional";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

const spaces = new Map<string, string>();
const people: string[] = [];

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

async function createTenancy(input: {
  space: string;
  moveIn: string;
  moveOut?: string;
  monthlyRentVnd?: bigint;
  depositVnd?: bigint;
}) {
  return prisma.tenancy.create({
    data: {
      spaceId: spaces.get(input.space)!,
      moveInDate: day(input.moveIn),
      moveOutDate: input.moveOut ? day(input.moveOut) : null,
      monthlyRentVnd: input.monthlyRentVnd ?? BigInt(3_000_000),
      depositVnd: input.depositVnd,
    },
  });
}

beforeAll(async () => {
  await removeFixtures();
  const property = await prisma.property.create({
    data: {
      name: fixturePrefix,
      floors: {
        create: {
          name: "Constraint floor",
          level: 1,
          sortOrder: 1,
          spaces: {
            create: [
              "dates",
              "money",
              "overlap",
              "open",
              "responsible",
              "references",
              "concurrency",
            ].map((name, index) => ({
              name: `${fixturePrefix} ${name}`,
              type: "ROOM" as const,
              sortOrder: index + 1,
            })),
          },
        },
      },
    },
    include: { floors: { include: { spaces: true } } },
  });
  for (const space of property.floors[0].spaces) {
    spaces.set(space.name.slice(`${fixturePrefix} `.length), space.id);
  }

  for (const name of ["A", "B", "C", "D", "E"]) {
    const person = await prisma.person.create({
      data: { fullName: `${fixturePrefix} Person ${name}` },
    });
    people.push(person.id);
  }
});

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

describe.sequential("tenancy database invariants", () => {
  it("accepts valid historical and future date-only periods", async () => {
    const historical = await createTenancy({
      space: "dates",
      moveIn: "2025-01-01",
      moveOut: "2025-02-01",
    });
    const future = await createTenancy({
      space: "dates",
      moveIn: "2035-01-01",
      moveOut: "2035-02-01",
    });
    expect(historical.moveInDate.toISOString().slice(0, 10)).toBe("2025-01-01");
    expect(future.moveOutDate?.toISOString().slice(0, 10)).toBe("2035-02-01");
  });

  it("rejects zero-length, reversed, and negative-money tenancies", async () => {
    await expect(
      createTenancy({
        space: "money",
        moveIn: "2026-01-01",
        moveOut: "2026-01-01",
      }),
    ).rejects.toThrow();
    await expect(
      createTenancy({
        space: "money",
        moveIn: "2026-02-01",
        moveOut: "2026-01-01",
      }),
    ).rejects.toThrow();
    await expect(
      createTenancy({
        space: "money",
        moveIn: "2026-01-01",
        moveOut: "2026-02-01",
        monthlyRentVnd: BigInt(-1),
      }),
    ).rejects.toThrow();
    await expect(
      createTenancy({
        space: "money",
        moveIn: "2026-01-01",
        moveOut: "2026-02-01",
        depositVnd: BigInt(-1),
      }),
    ).rejects.toThrow();
  });

  it("accepts adjacent periods and rejects overlapping or identical periods", async () => {
    await createTenancy({
      space: "overlap",
      moveIn: "2026-09-01",
      moveOut: "2026-10-01",
    });
    await expect(
      createTenancy({
        space: "overlap",
        moveIn: "2026-10-01",
        moveOut: "2026-11-01",
      }),
    ).resolves.toBeDefined();
    await expect(
      createTenancy({
        space: "overlap",
        moveIn: "2026-09-15",
        moveOut: "2026-10-15",
      }),
    ).rejects.toThrow();
    await expect(
      createTenancy({
        space: "overlap",
        moveIn: "2026-09-01",
        moveOut: "2026-10-01",
      }),
    ).rejects.toThrow();
  });

  it("treats a null move-out date as an unbounded upper period", async () => {
    await createTenancy({ space: "open", moveIn: "2026-09-01" });
    await expect(
      createTenancy({
        space: "open",
        moveIn: "2026-10-01",
        moveOut: "2026-11-01",
      }),
    ).rejects.toThrow();
  });

  it("supports multiple occupants and adjacent responsible-role history", async () => {
    const tenancy = await createTenancy({
      space: "responsible",
      moveIn: "2026-09-01",
      moveOut: "2026-12-01",
    });
    await expect(
      prisma.tenancyOccupant.create({
        data: {
          tenancyId: tenancy.id,
          personId: people[0],
          role: "RESPONSIBLE",
          startDate: day("2026-09-01"),
          endDate: day("2026-09-01"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.tenancyOccupant.create({
        data: {
          tenancyId: tenancy.id,
          personId: people[0],
          role: "RESPONSIBLE",
          startDate: day("2026-10-01"),
          endDate: day("2026-09-01"),
        },
      }),
    ).rejects.toThrow();
    await prisma.tenancyOccupant.createMany({
      data: [
        {
          tenancyId: tenancy.id,
          personId: people[0],
          role: "RESPONSIBLE",
          startDate: day("2026-09-01"),
          endDate: day("2026-10-15"),
        },
        {
          tenancyId: tenancy.id,
          personId: people[1],
          role: "ADDITIONAL",
          startDate: day("2026-09-01"),
          endDate: day("2026-12-01"),
        },
        {
          tenancyId: tenancy.id,
          personId: people[2],
          role: "ADDITIONAL",
          startDate: day("2026-09-01"),
          endDate: day("2026-12-01"),
        },
      ],
    });

    await expect(
      prisma.tenancyOccupant.create({
        data: {
          tenancyId: tenancy.id,
          personId: people[3],
          role: "RESPONSIBLE",
          startDate: day("2026-10-01"),
          endDate: day("2026-11-01"),
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.tenancyOccupant.create({
        data: {
          tenancyId: tenancy.id,
          personId: people[3],
          role: "RESPONSIBLE",
          startDate: day("2026-10-15"),
          endDate: day("2026-12-01"),
        },
      }),
    ).resolves.toBeDefined();

    await expect(
      prisma.tenancyOccupant.create({
        data: {
          tenancyId: tenancy.id,
          personId: people[0],
          role: "ADDITIONAL",
          startDate: day("2026-10-01"),
          endDate: day("2026-11-01"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.tenancyOccupant.create({
        data: {
          tenancyId: tenancy.id,
          personId: people[0],
          role: "ADDITIONAL",
          startDate: day("2026-10-15"),
          endDate: day("2026-12-01"),
        },
      }),
    ).resolves.toBeDefined();

    expect(
      await prisma.tenancyOccupant.count({
        where: { tenancyId: tenancy.id },
      }),
    ).toBe(5);
  });

  it("restricts destructive deletion of referenced history", async () => {
    const tenancy = await createTenancy({
      space: "references",
      moveIn: "2026-01-01",
      moveOut: "2026-02-01",
    });
    await prisma.tenancyOccupant.create({
      data: {
        tenancyId: tenancy.id,
        personId: people[4],
        role: "RESPONSIBLE",
        startDate: day("2026-01-01"),
        endDate: day("2026-02-01"),
      },
    });

    await expect(
      prisma.person.delete({ where: { id: people[4] } }),
    ).rejects.toThrow();
    await expect(
      prisma.space.delete({ where: { id: spaces.get("references")! } }),
    ).rejects.toThrow();
    await expect(
      prisma.tenancy.delete({ where: { id: tenancy.id } }),
    ).rejects.toThrow();
  });

  it("allows only one of two concurrent conflicting inserts to commit", async () => {
    const create = () =>
      createTenancy({
        space: "concurrency",
        moveIn: "2027-01-01",
        moveOut: "2027-02-01",
      });
    const results = await Promise.allSettled([create(), create()]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await prisma.tenancy.count({
        where: { spaceId: spaces.get("concurrency")! },
      }),
    ).toBe(1);
  });

  it("keeps the custom exclusion constraints installed", async () => {
    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'Tenancy_no_overlapping_space_periods',
        'TenancyOccupant_no_overlapping_person_periods',
        'TenancyOccupant_no_overlapping_responsible_periods'
      )
      ORDER BY conname
    `;
    expect(constraints.map((item) => item.conname)).toEqual([
      "TenancyOccupant_no_overlapping_person_periods",
      "TenancyOccupant_no_overlapping_responsible_periods",
      "Tenancy_no_overlapping_space_periods",
    ]);
  });
});
