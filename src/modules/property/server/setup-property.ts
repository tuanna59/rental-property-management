import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { InitialPropertySetupValues } from "../domain/setup-validation";

export class PropertyAlreadyConfiguredError extends Error {
  constructor() {
    super("Initial property setup has already been completed.");
    this.name = "PropertyAlreadyConfiguredError";
  }
}

function isSerializableConflict(error: unknown) {
  const prismaConflict =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034";
  const adapterConflict =
    error instanceof Error &&
    error.name === "DriverAdapterError" &&
    (error as Error & { cause?: { kind?: string } }).cause?.kind ===
      "TransactionWriteConflict";

  return prismaConflict || adapterConflict;
}

/**
 * Creates the single initial Property/Floor/Space graph atomically.
 * The existence check lives in the same serializable transaction so two
 * concurrent first-run submissions cannot create two bootstrap properties.
 */
export async function createInitialProperty(
  input: InitialPropertySetupValues,
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.property.findFirst({
            select: { id: true },
          });

          if (existing) {
            throw new PropertyAlreadyConfiguredError();
          }

          const property = await tx.property.create({
            data: {
              name: input.name,
              description: input.description ?? null,
              floors: {
                create: input.floors.map((floor, floorIndex) => ({
                  name: floor.name,
                  sortOrder: floorIndex + 1,
                  spaces:
                    floor.spaces.length > 0
                      ? {
                          create: floor.spaces.map((space, spaceIndex) => ({
                            name: space.name,
                            type: space.type,
                            sortOrder: spaceIndex + 1,
                          })),
                        }
                      : undefined,
                })),
              },
            },
            select: { id: true },
          });

          return property.id;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error instanceof PropertyAlreadyConfiguredError) throw error;
      if (!isSerializableConflict(error) || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 20));
    }
  }
}
