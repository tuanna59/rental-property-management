CREATE TYPE "InvoiceType" AS ENUM ('REGULAR', 'FINAL_SETTLEMENT');
CREATE TYPE "InvoiceAdjustmentType" AS ENUM ('CHARGE', 'CREDIT');

ALTER TABLE "Invoice"
  ADD COLUMN "invoiceDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'REGULAR',
  ALTER COLUMN "serviceStart" DROP NOT NULL,
  ALTER COLUMN "serviceEnd" DROP NOT NULL;

ALTER TABLE "InvoiceLine"
  ADD COLUMN "sourceBillingMonth" DATE,
  ADD COLUMN "servicePeriodStart" DATE,
  ADD COLUMN "servicePeriodEnd" DATE;

UPDATE "InvoiceLine" line
SET
  "sourceBillingMonth" = invoice."billingPeriod",
  "servicePeriodStart" = invoice."serviceStart",
  "servicePeriodEnd" = invoice."serviceEnd"
FROM "Invoice" invoice
WHERE line."invoiceId" = invoice."id";

DROP INDEX "Invoice_tenancyId_billingPeriod_key";
CREATE UNIQUE INDEX "Invoice_tenancyId_billingPeriod_type_key"
  ON "Invoice"("tenancyId", "billingPeriod", "type");
DROP INDEX "Invoice_billingPeriod_status_idx";
CREATE INDEX "Invoice_billingPeriod_type_status_idx"
  ON "Invoice"("billingPeriod", "type", "status");

CREATE TABLE "InvoiceAdjustment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" "InvoiceAdjustmentType" NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(16,0) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceAdjustment_invoiceId_createdAt_idx"
  ON "InvoiceAdjustment"("invoiceId", "createdAt");
ALTER TABLE "InvoiceAdjustment"
  ADD CONSTRAINT "InvoiceAdjustment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
