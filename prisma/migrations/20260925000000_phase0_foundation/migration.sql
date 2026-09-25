CREATE TYPE "SpaceType" AS ENUM (
  'ROOM',
  'OWNER_HOME',
  'GARAGE',
  'ROOFTOP',
  'COMMON_AREA',
  'STORAGE',
  'OTHER'
);

CREATE TABLE "Property" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "addressLine1" TEXT,
  "city" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Floor" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" INTEGER,
  "sortOrder" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Space" (
  "id" TEXT NOT NULL,
  "floorId" TEXT NOT NULL,
  "type" "SpaceType" NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Property_archivedAt_createdAt_idx" ON "Property"("archivedAt", "createdAt");
CREATE INDEX "Floor_propertyId_archivedAt_sortOrder_idx" ON "Floor"("propertyId", "archivedAt", "sortOrder");
CREATE INDEX "Space_floorId_archivedAt_sortOrder_idx" ON "Space"("floorId", "archivedAt", "sortOrder");
CREATE INDEX "Space_type_idx" ON "Space"("type");

ALTER TABLE "Floor"
  ADD CONSTRAINT "Floor_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Space"
  ADD CONSTRAINT "Space_floorId_fkey"
  FOREIGN KEY ("floorId") REFERENCES "Floor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
