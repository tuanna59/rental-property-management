ALTER TABLE "MeterReading" ADD COLUMN "billingMonth" DATE;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "meterId", DATE_TRUNC('month', "readingDate")
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS position
  FROM "MeterReading"
  WHERE "readingType" = 'MONTHLY'
)
UPDATE "MeterReading" AS reading
SET "billingMonth" = DATE_TRUNC('month', reading."readingDate")::date
FROM ranked
WHERE reading."id" = ranked."id" AND ranked.position = 1;

CREATE UNIQUE INDEX "MeterReading_meterId_billingMonth_key"
ON "MeterReading"("meterId", "billingMonth");
