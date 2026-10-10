-- Legacy DRAFT adjustments used InvoiceAdjustment before that model was reserved
-- for immutable post-finalization CREDIT / DEBIT corrections. Move any such
-- records into the draft invoice snapshot so they cannot be double-counted.
INSERT INTO "InvoiceLine" (
  "id",
  "invoiceId",
  "type",
  "description",
  "sourceBillingMonth",
  "servicePeriodStart",
  "servicePeriodEnd",
  "calculatedAmount",
  "finalAmount",
  "isOverridden",
  "overrideReason",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-draft-adjustment-' || a."invoiceId",
  a."invoiceId",
  'ADJUSTMENT'::"InvoiceLineType",
  string_agg(a."reason", '; ' ORDER BY a."createdAt"),
  NULL,
  NULL,
  NULL,
  SUM(CASE WHEN a."type" = 'CREDIT' THEN -a."amount" ELSE a."amount" END),
  SUM(CASE WHEN a."type" = 'CREDIT' THEN -a."amount" ELSE a."amount" END),
  FALSE,
  NULL,
  jsonb_build_object(
    'origin', 'LEGACY_DRAFT_ADJUSTMENT_MIGRATION',
    'legacyAdjustmentCount', COUNT(*)
  ),
  MIN(a."createdAt"),
  CURRENT_TIMESTAMP
FROM "InvoiceAdjustment" a
JOIN "Invoice" i ON i."id" = a."invoiceId"
WHERE i."status" = 'DRAFT'
  AND NOT EXISTS (
    SELECT 1
    FROM "InvoiceLine" l
    WHERE l."invoiceId" = a."invoiceId"
      AND l."type" = 'ADJUSTMENT'
  )
GROUP BY a."invoiceId"
HAVING SUM(CASE WHEN a."type" = 'CREDIT' THEN -a."amount" ELSE a."amount" END) <> 0;

DELETE FROM "InvoiceAdjustment" a
USING "Invoice" i
WHERE i."id" = a."invoiceId"
  AND i."status" = 'DRAFT';
