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
  "Nguyễn Văn An",
  "Trần Minh Hoàng",
  "Lê Quốc Bảo",
  "Phạm Gia Huy",
  "Võ Thanh Tùng",
  "Đặng Minh Khang",
  "Bùi Anh Tuấn",
  "Nguyễn Thị Lan",
  "Trần Ngọc Mai",
  "Lê Thu Trang",
] as const;

async function ensurePropertySeedData() {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.property.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (existing) {
        console.log("Existing property data preserved; property seed skipped.");
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

async function seed() {
  const property = await ensurePropertySeedData();

  await ensurePeopleSeedData();

  console.log(`Seeded property: ${property.name}`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
