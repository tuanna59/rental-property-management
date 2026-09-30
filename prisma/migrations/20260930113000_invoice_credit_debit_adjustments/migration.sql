-- Normalize invoice adjustment terminology for post-finalization financial corrections.
-- Existing CHARGE adjustments retain the same financial direction as DEBIT.

ALTER TYPE "InvoiceAdjustmentType" RENAME TO "InvoiceAdjustmentType_old";

CREATE TYPE "InvoiceAdjustmentType" AS ENUM ('CREDIT', 'DEBIT');

ALTER TABLE "InvoiceAdjustment"
  ALTER COLUMN "type" TYPE "InvoiceAdjustmentType"
  USING (
    CASE
      WHEN "type"::text = 'CHARGE' THEN 'DEBIT'
      ELSE "type"::text
    END
  )::"InvoiceAdjustmentType";

DROP TYPE "InvoiceAdjustmentType_old";
