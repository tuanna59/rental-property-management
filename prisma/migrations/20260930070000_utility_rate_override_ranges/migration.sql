-- Replace electricity-only, single-month overrides with generic utility overrides
-- that support electricity/water and an effective month range.
CREATE TABLE "UtilityRateOverride" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "utilityType" "UtilityType" NOT NULL,
    "rate" DECIMAL(16,3) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityRateOverride_pkey" PRIMARY KEY ("id")
);

-- Preserve every existing electricity override as a one-month range.
INSERT INTO "UtilityRateOverride" (
    "id",
    "spaceId",
    "utilityType",
    "rate",
    "effectiveFrom",
    "effectiveTo",
    "reason",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "spaceId",
    'ELECTRICITY'::"UtilityType",
    "rate",
    "billingMonth",
    ("billingMonth" + INTERVAL '1 month')::date,
    "reason",
    "createdAt",
    "updatedAt"
FROM "ElectricityRateOverride";

DROP TABLE "ElectricityRateOverride";

CREATE UNIQUE INDEX "UtilityRateOverride_spaceId_utilityType_effectiveFrom_key"
ON "UtilityRateOverride"("spaceId", "utilityType", "effectiveFrom");

CREATE INDEX "UtilityRateOverride_spaceId_utilityType_effectiveFrom_effectiveTo_idx"
ON "UtilityRateOverride"("spaceId", "utilityType", "effectiveFrom", "effectiveTo");

ALTER TABLE "UtilityRateOverride"
ADD CONSTRAINT "UtilityRateOverride_spaceId_fkey"
FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
