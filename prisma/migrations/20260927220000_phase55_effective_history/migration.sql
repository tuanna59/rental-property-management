CREATE TABLE "TenancyRentRate" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "monthlyRentVnd" BIGINT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenancyRentRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenancyResponsibleAssignment" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "occupantId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenancyResponsibleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeterMonthlyClosing" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "billingMonth" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeterMonthlyClosing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeterReadingPhoto" (
    "id" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeterReadingPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceMeterEvidence" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceMeterEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenancyRentRate_tenancyId_effectiveFrom_key" ON "TenancyRentRate"("tenancyId", "effectiveFrom");
CREATE INDEX "TenancyRentRate_tenancyId_effectiveFrom_idx" ON "TenancyRentRate"("tenancyId", "effectiveFrom");
CREATE UNIQUE INDEX "TenancyResponsibleAssignment_tenancyId_effectiveFrom_key" ON "TenancyResponsibleAssignment"("tenancyId", "effectiveFrom");
CREATE INDEX "TenancyResponsibleAssignment_occupantId_effectiveFrom_idx" ON "TenancyResponsibleAssignment"("occupantId", "effectiveFrom");
CREATE UNIQUE INDEX "MeterMonthlyClosing_meterId_billingMonth_key" ON "MeterMonthlyClosing"("meterId", "billingMonth");
CREATE UNIQUE INDEX "MeterMonthlyClosing_readingId_billingMonth_key" ON "MeterMonthlyClosing"("readingId", "billingMonth");
CREATE INDEX "MeterMonthlyClosing_readingId_idx" ON "MeterMonthlyClosing"("readingId");
CREATE INDEX "MeterReadingPhoto_readingId_createdAt_idx" ON "MeterReadingPhoto"("readingId", "createdAt");
CREATE UNIQUE INDEX "InvoiceMeterEvidence_invoiceId_readingId_key" ON "InvoiceMeterEvidence"("invoiceId", "readingId");
CREATE INDEX "InvoiceMeterEvidence_readingId_idx" ON "InvoiceMeterEvidence"("readingId");

ALTER TABLE "TenancyRentRate" ADD CONSTRAINT "TenancyRentRate_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenancyResponsibleAssignment" ADD CONSTRAINT "TenancyResponsibleAssignment_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenancyResponsibleAssignment" ADD CONSTRAINT "TenancyResponsibleAssignment_occupantId_fkey" FOREIGN KEY ("occupantId") REFERENCES "TenancyOccupant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeterMonthlyClosing" ADD CONSTRAINT "MeterMonthlyClosing_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeterMonthlyClosing" ADD CONSTRAINT "MeterMonthlyClosing_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeterReadingPhoto" ADD CONSTRAINT "MeterReadingPhoto_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "MeterReading"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceMeterEvidence" ADD CONSTRAINT "InvoiceMeterEvidence_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceMeterEvidence" ADD CONSTRAINT "InvoiceMeterEvidence_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "TenancyRentRate" ("id", "tenancyId", "monthlyRentVnd", "effectiveFrom", "reason", "createdAt")
SELECT CONCAT('initial-rent-', "id"), "id", "monthlyRentVnd", "moveInDate", 'Initial rent', "createdAt"
FROM "Tenancy";

INSERT INTO "TenancyResponsibleAssignment" ("id", "tenancyId", "occupantId", "effectiveFrom", "reason", "createdAt")
SELECT CONCAT('initial-responsible-', occupant."id"), occupant."tenancyId", occupant."id",
       GREATEST(occupant."startDate", tenancy."moveInDate"), 'Initial responsible renter', occupant."createdAt"
FROM "TenancyOccupant" occupant
JOIN "Tenancy" tenancy ON tenancy."id" = occupant."tenancyId"
WHERE occupant."role" = 'RESPONSIBLE';

INSERT INTO "MeterMonthlyClosing" ("id", "meterId", "readingId", "billingMonth", "createdAt")
SELECT CONCAT('legacy-closing-', "id"), "meterId", "id", "billingMonth", "createdAt"
FROM "MeterReading"
WHERE "billingMonth" IS NOT NULL;

INSERT INTO "MeterReadingPhoto" ("id", "readingId", "storageKey", "createdAt")
SELECT CONCAT('legacy-photo-', "id"), "id", "photoStorageKey", "createdAt"
FROM "MeterReading"
WHERE "photoStorageKey" IS NOT NULL;
