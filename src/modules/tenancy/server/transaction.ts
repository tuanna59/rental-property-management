import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isWriteConflict(error: unknown) {
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

export async function tenancyTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (!isWriteConflict(error) || attempt >= 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 15));
    }
  }
}
