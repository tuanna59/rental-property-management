CREATE TYPE "InvoiceMeterEvidenceRole" AS ENUM (
  'OPENING_ANCHOR',
  'CLOSING',
  'MANUAL_EVIDENCE',
  'MOVE_IN_BOUNDARY',
  'MOVE_OUT_BOUNDARY',
  'METER_INSTALL',
  'METER_REMOVAL'
);

ALTER TABLE "InvoiceMeterEvidence"
ADD COLUMN "role" "InvoiceMeterEvidenceRole";

UPDATE "InvoiceMeterEvidence" evidence
SET "role" = CASE reading."readingType"
  WHEN 'MOVE_IN' THEN 'MOVE_IN_BOUNDARY'::"InvoiceMeterEvidenceRole"
  WHEN 'MOVE_OUT' THEN 'MOVE_OUT_BOUNDARY'::"InvoiceMeterEvidenceRole"
  WHEN 'METER_INSTALL' THEN 'METER_INSTALL'::"InvoiceMeterEvidenceRole"
  WHEN 'METER_REMOVAL' THEN 'METER_REMOVAL'::"InvoiceMeterEvidenceRole"
  ELSE 'MANUAL_EVIDENCE'::"InvoiceMeterEvidenceRole"
END
FROM "MeterReading" reading
WHERE reading."id" = evidence."readingId";

UPDATE "InvoiceMeterEvidence" evidence
SET "role" = 'OPENING_ANCHOR'
FROM "InvoiceLine" line,
LATERAL jsonb_array_elements(COALESCE(line."metadata"->'meterSegments', '[]'::jsonb)) segment,
"MeterReading" reading
WHERE line."invoiceId" = evidence."invoiceId"
  AND line."type" = 'ELECTRICITY'
  AND reading."id" = evidence."readingId"
  AND reading."meterId" = segment->>'meterId'
  AND reading."readingDate" = (segment->'openingReading'->>'date')::date;

UPDATE "InvoiceMeterEvidence" evidence
SET "role" = 'CLOSING'
FROM "InvoiceLine" line,
LATERAL jsonb_array_elements(COALESCE(line."metadata"->'meterSegments', '[]'::jsonb)) segment,
"MeterReading" reading
WHERE line."invoiceId" = evidence."invoiceId"
  AND line."type" = 'ELECTRICITY'
  AND reading."id" = evidence."readingId"
  AND reading."meterId" = segment->>'meterId'
  AND reading."readingDate" = (segment->'closingReading'->>'date')::date;
