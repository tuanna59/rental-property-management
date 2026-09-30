-- Allow historical VOIDED invoices while preserving one active invoice per logical period.
DROP INDEX IF EXISTS "Invoice_tenancyId_billingPeriod_type_key";
CREATE UNIQUE INDEX "Invoice_active_tenancy_period_type_key"
  ON "Invoice"("tenancyId", "billingPeriod", "type")
  WHERE "status" <> 'VOIDED';

CREATE INDEX "Invoice_tenancyId_billingPeriod_type_status_idx"
  ON "Invoice"("tenancyId", "billingPeriod", "type", "status");
