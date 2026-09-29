-- Phase 7: physical asset inventory and device registry foundation.
-- Existing Operations records remain valid because new asset links are nullable.

CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'RETIRED', 'DISPOSED');
CREATE TYPE "AssetAttachmentType" AS ENUM ('PHOTO', 'RECEIPT', 'WARRANTY', 'MANUAL', 'SERIAL', 'OTHER');
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "floorId" TEXT,
    "spaceId" TEXT,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" DATE,
    "purchasePrice" DECIMAL(16,0),
    "warrantyExpiresAt" DATE,
    "notes" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "replacementForAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetAttachment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetAttachmentType" NOT NULL,
    "title" TEXT,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "floorId" TEXT,
    "spaceId" TEXT,
    "assetId" TEXT,
    "meterId" TEXT,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "externalId" TEXT,
    "protocol" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MaintenanceIssue" ADD COLUMN "assetId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "assetId" TEXT;

CREATE UNIQUE INDEX "AssetCategory_propertyId_name_key" ON "AssetCategory"("propertyId", "name");
CREATE INDEX "AssetCategory_propertyId_archivedAt_name_idx" ON "AssetCategory"("propertyId", "archivedAt", "name");
CREATE UNIQUE INDEX "Asset_replacementForAssetId_key" ON "Asset"("replacementForAssetId");
CREATE INDEX "Asset_propertyId_status_idx" ON "Asset"("propertyId", "status");
CREATE INDEX "Asset_categoryId_status_idx" ON "Asset"("categoryId", "status");
CREATE INDEX "Asset_floorId_status_idx" ON "Asset"("floorId", "status");
CREATE INDEX "Asset_spaceId_status_idx" ON "Asset"("spaceId", "status");
CREATE INDEX "Asset_warrantyExpiresAt_idx" ON "Asset"("warrantyExpiresAt");
CREATE INDEX "AssetAttachment_assetId_type_createdAt_idx" ON "AssetAttachment"("assetId", "type", "createdAt");
CREATE INDEX "Device_propertyId_status_idx" ON "Device"("propertyId", "status");
CREATE INDEX "Device_spaceId_status_idx" ON "Device"("spaceId", "status");
CREATE INDEX "Device_assetId_idx" ON "Device"("assetId");
CREATE INDEX "Device_meterId_idx" ON "Device"("meterId");
CREATE INDEX "Device_archivedAt_idx" ON "Device"("archivedAt");
CREATE INDEX "MaintenanceIssue_assetId_status_idx" ON "MaintenanceIssue"("assetId", "status");
CREATE INDEX "Expense_assetId_expenseDate_idx" ON "Expense"("assetId", "expenseDate");

ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_replacementForAssetId_fkey" FOREIGN KEY ("replacementForAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetAttachment" ADD CONSTRAINT "AssetAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceIssue" ADD CONSTRAINT "MaintenanceIssue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
