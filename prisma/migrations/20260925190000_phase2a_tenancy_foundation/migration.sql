CREATE TYPE "TenancyOccupantRole" AS ENUM (
  'RESPONSIBLE',
  'ADDITIONAL'
);

CREATE TABLE "Tenancy" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "moveInDate" DATE NOT NULL,
  "moveOutDate" DATE,
  "monthlyRentVnd" BIGINT NOT NULL,
  "depositVnd" BIGINT,
  "moveInNotes" TEXT,
  "moveOutNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Tenancy_valid_period_check"
    CHECK ("moveOutDate" IS NULL OR "moveOutDate" > "moveInDate"),
  CONSTRAINT "Tenancy_nonnegative_monthly_rent_check"
    CHECK ("monthlyRentVnd" >= 0),
  CONSTRAINT "Tenancy_nonnegative_deposit_check"
    CHECK ("depositVnd" IS NULL OR "depositVnd" >= 0)
);

CREATE TABLE "TenancyOccupant" (
  "id" TEXT NOT NULL,
  "tenancyId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "role" "TenancyOccupantRole" NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenancyOccupant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenancyOccupant_valid_period_check"
    CHECK ("endDate" IS NULL OR "endDate" > "startDate")
);

CREATE INDEX "Tenancy_spaceId_moveInDate_idx"
  ON "Tenancy"("spaceId", "moveInDate");
CREATE INDEX "TenancyOccupant_tenancyId_startDate_idx"
  ON "TenancyOccupant"("tenancyId", "startDate");
CREATE INDEX "TenancyOccupant_personId_startDate_idx"
  ON "TenancyOccupant"("personId", "startDate");

ALTER TABLE "Tenancy"
  ADD CONSTRAINT "Tenancy_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "Space"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenancyOccupant"
  ADD CONSTRAINT "TenancyOccupant_tenancyId_fkey"
  FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenancyOccupant"
  ADD CONSTRAINT "TenancyOccupant_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot represent PostgreSQL exclusion constraints. These constraints
-- are migration-owned and must remain in future migrations and drift reviews.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Tenancy"
  ADD CONSTRAINT "Tenancy_no_overlapping_space_periods"
  EXCLUDE USING gist (
    "spaceId" WITH =,
    daterange("moveInDate", "moveOutDate", '[)') WITH &&
  );

-- A person may have adjacent history segments in one tenancy, but never
-- contradictory overlapping segments.
ALTER TABLE "TenancyOccupant"
  ADD CONSTRAINT "TenancyOccupant_no_overlapping_person_periods"
  EXCLUDE USING gist (
    "tenancyId" WITH =,
    "personId" WITH =,
    daterange("startDate", "endDate", '[)') WITH &&
  );

-- This period-aware rule permits an adjacent handoff from one responsible
-- person to another while enforcing at most one responsible person at a time.
ALTER TABLE "TenancyOccupant"
  ADD CONSTRAINT "TenancyOccupant_no_overlapping_responsible_periods"
  EXCLUDE USING gist (
    "tenancyId" WITH =,
    daterange("startDate", "endDate", '[)') WITH &&
  )
  WHERE ("role" = 'RESPONSIBLE'::"TenancyOccupantRole");
