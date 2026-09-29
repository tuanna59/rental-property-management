import { prisma } from "@/lib/prisma";

export type OperationsPrismaClient = typeof prisma & {
  maintenanceIssue?: any;
  maintenancePhoto?: any;
  expense?: any;
  task?: any;
  asset?: any;
};

export function operationsDb(client: unknown = prisma) {
  return client as OperationsPrismaClient;
}

export function operationsSchemaReady(client: unknown = prisma) {
  const db = operationsDb(client);
  return Boolean(
    db.maintenanceIssue?.findMany &&
      db.maintenancePhoto?.findMany &&
      db.expense?.findMany &&
      db.task?.findMany,
  );
}

export function requireOperationsSchema(client: unknown = prisma) {
  if (!operationsSchemaReady(client)) {
    throw new Error(
      "Operations database schema is not installed yet. Apply the Operations Prisma migration and regenerate Prisma Client before saving Operations data.",
    );
  }
  return operationsDb(client);
}
