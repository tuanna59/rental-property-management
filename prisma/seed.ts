import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  Prisma,
  PrismaClient,
} from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const utilityStartDate = new Date("2026-01-01T00:00:00.000Z");

const initialFloors = [
  {
    name: "Floor 1",
    level: 1,
    spaces: [
      { name: "Garage", type: "GARAGE" },
      { name: "Owner Home", type: "OWNER_HOME" },
    ],
  },
  {
    name: "Floor 2",
    level: 2,
    spaces: [
      { name: "P01", type: "ROOM" },
      { name: "P02", type: "ROOM" },
      { name: "P03", type: "ROOM" },
      { name: "P04", type: "ROOM" },
    ],
  },
  {
    name: "Floor 3",
    level: 3,
    spaces: [
      { name: "P05", type: "ROOM" },
      { name: "P06", type: "ROOM" },
      { name: "P07", type: "ROOM" },
      { name: "P08", type: "ROOM" },
    ],
  },
  {
    name: "Rooftop",
    level: 4,
    spaces: [{ name: "Rooftop", type: "ROOFTOP" }],
  },
] as const;

const initialPeople = [
  "Xuân Quỳnh",
  "Hoàng Ni",
  "Ben",
  "Bin",
  "Thẩm",
  "Quang Thành",
  "Hana",
  "Linh",
  "Quyên",
  "Trọng Nghĩa",
] as const;

const initialElectricityMeters = [
  { room: "P01", meterNumber: "CT01" },
  { room: "P02", meterNumber: "CT02" },
  { room: "P03", meterNumber: "CT03" },
  { room: "P04", meterNumber: "CT04" },
] as const;

async function ensurePropertySeedData() {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.property.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (existing) {
        console.log(
          "Existing property data preserved; property seed skipped.",
        );

        return existing;
      }

      return tx.property.create({
        data: {
          name: "My Rental Property",
          description: "A place for everyday living.",
          city: "Ho Chi Minh City",
          country: "Vietnam",
          floors: {
            create: initialFloors.map((floor, index) => ({
              name: floor.name,
              level: floor.level,
              sortOrder: index + 1,
              spaces: {
                create: floor.spaces.map((space, spaceIndex) => ({
                  name: space.name,
                  type: space.type,
                  sortOrder: spaceIndex + 1,
                })),
              },
            })),
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

async function ensurePeopleSeedData() {
  const existingPeople = await prisma.person.findMany({
    where: {
      fullName: {
        in: [...initialPeople],
      },
    },
    select: {
      fullName: true,
    },
  });

  const existingNames = new Set(
    existingPeople.map((person) => person.fullName),
  );

  const peopleToCreate = initialPeople
    .filter((fullName) => !existingNames.has(fullName))
    .map((fullName) => ({
      fullName,
    }));

  if (peopleToCreate.length === 0) {
    console.log("Seed people already exist; people seed skipped.");
    return;
  }

  await prisma.person.createMany({
    data: peopleToCreate,
  });

  console.log(`Seeded ${peopleToCreate.length} people.`);
}

async function ensureUtilityRateSeedData(propertyId: string) {
  const initialRates = [
    {
      utilityType: "ELECTRICITY" as const,
      rate: new Prisma.Decimal("3800"),
      notes: "Initial electricity rate",
    },
    {
      utilityType: "WATER" as const,
      rate: new Prisma.Decimal("50000"),
      notes: "Initial water rate",
    },
  ];

  for (const rate of initialRates) {
    const existing = await prisma.utilityRate.findFirst({
      where: {
        propertyId,
        utilityType: rate.utilityType,
        effectiveFrom: utilityStartDate,
      },
    });

    if (existing) {
      console.log(
        `${rate.utilityType} rate effective 2026-01-01 already exists; skipped.`,
      );

      continue;
    }

    await prisma.utilityRate.create({
      data: {
        propertyId,
        utilityType: rate.utilityType,
        rate: rate.rate,
        effectiveFrom: utilityStartDate,
        effectiveTo: null,
        notes: rate.notes,
      },
    });

    console.log(
      `Seeded ${rate.utilityType} rate: ${rate.rate.toString()}.`,
    );
  }
}

async function ensureInitialMeterReading(meterId: string) {
  const existingInstallReading = await prisma.meterReading.findFirst({
    where: {
      meterId,
      readingType: "METER_INSTALL",
    },
    orderBy: {
      readingDate: "asc",
    },
  });

  if (existingInstallReading) {
    return;
  }

  await prisma.meterReading.create({
    data: {
      meterId,
      readingDate: utilityStartDate,
      billingMonth: null,
      readingValue: new Prisma.Decimal("0"),
      readingType: "METER_INSTALL",
      source: "MEASURED",
      notes: "Initial seeded meter reading",
    },
  });

  console.log(`Seeded initial 0 kWh reading for meter ${meterId}.`);
}

async function ensureElectricityMeterSeedData(propertyId: string) {
  const property = await prisma.property.findUniqueOrThrow({
    where: {
      id: propertyId,
    },
    include: {
      floors: {
        include: {
          spaces: true,
        },
      },
    },
  });

  const spaces = property.floors.flatMap((floor) => floor.spaces);

  for (const definition of initialElectricityMeters) {
    const space = spaces.find(
      (space) =>
        space.name === definition.room &&
        space.type === "ROOM",
    );

    if (!space) {
      throw new Error(
        `Seed room ${definition.room} was not found in property ${property.name}.`,
      );
    }

    let meter = await prisma.meter.findFirst({
      where: {
        spaceId: space.id,
        type: "ELECTRICITY",
        meterNumber: definition.meterNumber,
      },
    });

    if (!meter) {
      meter = await prisma.meter.create({
        data: {
          spaceId: space.id,
          type: "ELECTRICITY",
          meterNumber: definition.meterNumber,
          installedAt: utilityStartDate,
          notes: "Initial seeded electricity meter",
        },
      });

      console.log(
        `Seeded ${definition.room} meter ${definition.meterNumber}.`,
      );
    } else {
      console.log(
        `${definition.room} meter ${definition.meterNumber} already exists; meter seed skipped.`,
      );
    }

    await ensureInitialMeterReading(meter.id);
  }
}

async function seed() {
  const property = await ensurePropertySeedData();

  await ensurePeopleSeedData();
  await ensureUtilityRateSeedData(property.id);
  await ensureElectricityMeterSeedData(property.id);

  console.log(`Seed completed for property: ${property.name}`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });