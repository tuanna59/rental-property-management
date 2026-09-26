CREATE TABLE "Person" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT,
  "phoneNormalized" TEXT,
  "dateOfBirth" DATE,
  "citizenIdEncrypted" TEXT,
  "citizenIdLookupHash" TEXT,
  "citizenIdLast4" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Person_citizenIdLookupHash_key" ON "Person"("citizenIdLookupHash");
CREATE INDEX "Person_phoneNormalized_idx" ON "Person"("phoneNormalized");
CREATE INDEX "Person_archivedAt_createdAt_idx" ON "Person"("archivedAt", "createdAt");
