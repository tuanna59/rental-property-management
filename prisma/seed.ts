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
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.property.findFirst({
        orderBy: { createdAt: "asc" },
      });
      if (existing) {
        console.log("Existing property data preserved; seed skipped.");
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
