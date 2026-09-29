-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('REPAIR', 'UTILITIES', 'CLEANING', 'SUPPLIES', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskLinkedEntityType" AS ENUM ('PROPERTY', 'SPACE', 'MAINTENANCE', 'INVOICE');

-- CreateEnum
CREATE TYPE "TaskRecurrenceUnit" AS ENUM ('DAYS', 'MONTHS', 'YEARS');

-- CreateTable
CREATE TABLE "MaintenanceIssue" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "floorId" TEXT,
    "spaceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "reportedAt" DATE NOT NULL,
    "reportedBy" TEXT,
    "assignedTo" TEXT,
    "notes" TEXT,
    "resolution" TEXT,
    "completedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePhoto" (
    "id" TEXT NOT NULL,
    "maintenanceIssueId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenancePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "floorId" TEXT,
    "spaceId" TEXT,
    "maintenanceIssueId" TEXT,
    "expenseDate" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(16,0) NOT NULL,
    "receiptStorageKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" DATE,
    "linkedEntityType" "TaskLinkedEntityType",
    "linkedEntityId" TEXT,
    "recurrenceUnit" "TaskRecurrenceUnit",
    "recurrenceInterval" INTEGER,
    "completedAt" TIMESTAMP(3),
    "previousOccurrenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceIssue_propertyId_status_priority_idx" ON "MaintenanceIssue"("propertyId", "status", "priority");

-- CreateIndex
CREATE INDEX "MaintenanceIssue_floorId_status_idx" ON "MaintenanceIssue"("floorId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceIssue_spaceId_status_idx" ON "MaintenanceIssue"("spaceId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceIssue_reportedAt_idx" ON "MaintenanceIssue"("reportedAt");

-- CreateIndex
CREATE INDEX "MaintenanceIssue_archivedAt_idx" ON "MaintenanceIssue"("archivedAt");

-- CreateIndex
CREATE INDEX "MaintenancePhoto_maintenanceIssueId_createdAt_idx" ON "MaintenancePhoto"("maintenanceIssueId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_propertyId_expenseDate_idx" ON "Expense"("propertyId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_floorId_expenseDate_idx" ON "Expense"("floorId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_spaceId_expenseDate_idx" ON "Expense"("spaceId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_maintenanceIssueId_idx" ON "Expense"("maintenanceIssueId");

-- CreateIndex
CREATE INDEX "Expense_archivedAt_idx" ON "Expense"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_previousOccurrenceId_key" ON "Task"("previousOccurrenceId");

-- CreateIndex
CREATE INDEX "Task_propertyId_status_dueDate_idx" ON "Task"("propertyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_linkedEntityType_linkedEntityId_idx" ON "Task"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "Task_archivedAt_idx" ON "Task"("archivedAt");

-- AddForeignKey
ALTER TABLE "MaintenanceIssue" ADD CONSTRAINT "MaintenanceIssue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceIssue" ADD CONSTRAINT "MaintenanceIssue_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceIssue" ADD CONSTRAINT "MaintenanceIssue_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_maintenanceIssueId_fkey" FOREIGN KEY ("maintenanceIssueId") REFERENCES "MaintenanceIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_maintenanceIssueId_fkey" FOREIGN KEY ("maintenanceIssueId") REFERENCES "MaintenanceIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_previousOccurrenceId_fkey" FOREIGN KEY ("previousOccurrenceId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
