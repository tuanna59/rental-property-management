-- Add historical void state without changing existing invoices.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

ALTER TABLE "Invoice"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "replacesInvoiceId" TEXT;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_replacesInvoiceId_fkey"
  FOREIGN KEY ("replacesInvoiceId") REFERENCES "Invoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Invoice_replacesInvoiceId_key"
  ON "Invoice"("replacesInvoiceId");
