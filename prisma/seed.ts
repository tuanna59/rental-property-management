import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const initialFloors = [
  {
    name: "Floor 1",
    level: 1,
    spaces: [
      { name: "Owner Home", type: "OWNER_HOME" },
      { name: "Garage", type: "GARAGE" },
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

async function ensureSeedData() {
  const property =
    (await prisma.property.findFirst({
      where: { name: "My Rental Property", archivedAt: null },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.property.create({
      data: {
        name: "My Rental Property",
        description: "Initial configurable rental property.",
        city: "Ho Chi Minh City",
        country: "Vietnam",
      },
    }));

  for (const [floorIndex, floorSeed] of initialFloors.entries()) {
    const floor =
      (await prisma.floor.findFirst({
        where: {
          propertyId: property.id,
          name: floorSeed.name,
          archivedAt: null,
        },
      })) ??
      (await prisma.floor.create({
        data: {
          propertyId: property.id,
          name: floorSeed.name,
          level: floorSeed.level,
          sortOrder: floorIndex + 1,
        },
      }));

    await prisma.floor.update({
      where: { id: floor.id },
      data: {
        level: floorSeed.level,
        sortOrder: floorIndex + 1,
      },
    });

    for (const [spaceIndex, spaceSeed] of floorSeed.spaces.entries()) {
      const space = await prisma.space.findFirst({
        where: {
          floorId: floor.id,
          name: spaceSeed.name,
          archivedAt: null,
        },
      });

      if (space) {
        await prisma.space.update({
          where: { id: space.id },
          data: {
            type: spaceSeed.type,
            sortOrder: spaceIndex + 1,
          },
        });
      } else {
        await prisma.space.create({
          data: {
            floorId: floor.id,
            name: spaceSeed.name,
            type: spaceSeed.type,
            sortOrder: spaceIndex + 1,
          },
        });
      }
    }
  }

  return property;
}

ensureSeedData()
  .then((property) => {
    console.log(`Seeded ${property.name}`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
