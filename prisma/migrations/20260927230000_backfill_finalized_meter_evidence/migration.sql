-- Preserve dependencies already captured by newer invoice snapshots.
INSERT INTO "InvoiceMeterEvidence" ("id", "invoiceId", "readingId", "createdAt")
SELECT CONCAT('backfill-id-', invoice."id", '-', reading."id"),
       invoice."id",
       reading."id",
       COALESCE(invoice."finalizedAt", invoice."updatedAt")
FROM "Invoice" invoice
JOIN "InvoiceLine" line ON line."invoiceId" = invoice."id" AND line."type" = 'ELECTRICITY'
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(line."metadata"->'meterSegments', '[]'::jsonb)) segment
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(segment->'sourceReadingIds', '[]'::jsonb)) reading_id
JOIN "MeterReading" reading ON reading."id" = reading_id
WHERE invoice."status" = 'FINALIZED'
ON CONFLICT ("invoiceId", "readingId") DO NOTHING;

-- Older finalized snapshots did not store IDs. Their immutable opening/closing
-- dates still identify the full same-meter evidence interval used to calculate
-- the finalized segment, including intermediate manual and lifecycle readings.
INSERT INTO "InvoiceMeterEvidence" ("id", "invoiceId", "readingId", "createdAt")
SELECT CONCAT('backfill-range-', invoice."id", '-', reading."id"),
       invoice."id",
       reading."id",
       COALESCE(invoice."finalizedAt", invoice."updatedAt")
FROM "Invoice" invoice
JOIN "InvoiceLine" line ON line."invoiceId" = invoice."id" AND line."type" = 'ELECTRICITY'
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(line."metadata"->'meterSegments', '[]'::jsonb)) segment
JOIN "MeterReading" reading
  ON reading."meterId" = segment->>'meterId'
 AND reading."readingDate" >= (segment->'openingReading'->>'date')::date
 AND reading."readingDate" <= (segment->'closingReading'->>'date')::date
WHERE invoice."status" = 'FINALIZED'
  AND segment->'openingReading'->>'date' IS NOT NULL
  AND segment->'closingReading'->>'date' IS NOT NULL
ON CONFLICT ("invoiceId", "readingId") DO NOTHING;
