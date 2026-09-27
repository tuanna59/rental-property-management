CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED');
CREATE TYPE "InvoiceLineType" AS ENUM ('RENT', 'ELECTRICITY', 'WATER');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');
CREATE TYPE "DepositTransactionType" AS ENUM ('RECEIPT', 'REFUND', 'DEDUCTION', 'APPLIED_TO_INVOICE');
CREATE TYPE "DepositDeductionCategory" AS ENUM ('DAMAGE', 'CLEANING', 'OUTSTANDING_INVOICE', 'OTHER');

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "tenancyId" TEXT NOT NULL,
  "billingPeriod" DATE NOT NULL,
  "serviceStart" DATE NOT NULL,
  "serviceEnd" DATE NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "propertyNameSnapshot" TEXT NOT NULL,
  "roomNameSnapshot" TEXT NOT NULL,
  "renterNameSnapshot" TEXT NOT NULL,
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" "InvoiceLineType" NOT NULL,
  "description" TEXT NOT NULL,
  "calculatedAmount" DECIMAL(16,3) NOT NULL,
  "finalAmount" DECIMAL(16,0) NOT NULL,
  "isOverridden" BOOLEAN NOT NULL DEFAULT false,
  "overrideReason" TEXT,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(16,0) NOT NULL,
  "paymentDate" DATE NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "isDepositApplication" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepositTransaction" (
  "id" TEXT NOT NULL,
  "tenancyId" TEXT NOT NULL,
  "type" "DepositTransactionType" NOT NULL,
  "amount" DECIMAL(16,0) NOT NULL,
  "transactionDate" DATE NOT NULL,
  "category" "DepositDeductionCategory",
  "invoiceId" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepositTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_tenancyId_billingPeriod_key" ON "Invoice"("tenancyId", "billingPeriod");
CREATE INDEX "Invoice_billingPeriod_status_idx" ON "Invoice"("billingPeriod", "status");
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_type_key" ON "InvoiceLine"("invoiceId", "type");
CREATE INDEX "Payment_invoiceId_paymentDate_idx" ON "Payment"("invoiceId", "paymentDate");
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");
CREATE INDEX "DepositTransaction_tenancyId_transactionDate_idx" ON "DepositTransaction"("tenancyId", "transactionDate");
CREATE INDEX "DepositTransaction_invoiceId_idx" ON "DepositTransaction"("invoiceId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepositTransaction" ADD CONSTRAINT "DepositTransaction_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepositTransaction" ADD CONSTRAINT "DepositTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
