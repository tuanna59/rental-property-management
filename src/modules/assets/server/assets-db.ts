import { prisma } from "@/lib/prisma";

export type AssetsPrismaClient = typeof prisma & {
  assetCategory?: any;
  asset?: any;
  assetAttachment?: any;
  device?: any;
  maintenanceIssue?: any;
  expense?: any;
};

export function assetsDb(client: unknown = prisma) {
  return client as AssetsPrismaClient;
}

export function assetsSchemaReady(client: unknown = prisma) {
  const db = assetsDb(client);
  return Boolean(db.asset?.findMany && db.assetCategory?.findMany && db.device?.findMany);
}

export function requireAssetsSchema(client: unknown = prisma) {
  if (!assetsSchemaReady(client)) {
    throw new Error(
      "Assets database schema is not installed yet. Apply the Assets migration and regenerate Prisma Client before saving Assets data.",
    );
  }
  return assetsDb(client);
}
