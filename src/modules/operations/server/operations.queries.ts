import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/presentation";

import type {
  ExpenseCategory,
  ExpensePageView,
  MaintenanceListItemView,
  MaintenancePageView,
  OperationsInvoiceOption,
  OperationsLocationOption,
  SpaceMaintenanceSignal,
  TaskLinkedEntityType,
  TaskPageView,
} from "../domain/types";
import { operationsDb, operationsSchemaReady } from "./operations-db";

function monthBounds(month: string) {
  const normalized = /^\d{4}-\d{2}$/.test(month)
    ? month
    : new Date().toISOString().slice(0, 7);
  const [year, value] = normalized.split("-").map(Number);
  const start = new Date(Date.UTC(year, value - 1, 1));
  const end = new Date(Date.UTC(year, value, 1));
  return { month: normalized, start, end };
}

function stringMoney(value: unknown) {
  if (value === null || value === undefined) return "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.trunc(value).toString();
  if (typeof value === "string") return value.split(".")[0];
  if (typeof value === "object" && "toString" in value) {
    return String((value as { toString(): string }).toString()).split(".")[0];
  }
  return "0";
}

function addMoney(left: bigint, value: unknown) {
  try {
    return left + BigInt(stringMoney(value));
  } catch {
    return left;
  }
}

export async function getOperationsLocations(
  propertyId: string,
): Promise<OperationsLocationOption[]> {
  const floors = await prisma.floor.findMany({
    where: { propertyId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      spaces: {
        where: { archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      },
    },
  });

  return floors.flatMap((floor) =>
    floor.spaces.map((space) => ({
      floorId: floor.id,
      floorName: floor.name,
      spaceId: space.id,
      spaceName: space.name,
    })),
  );
}

export async function getMaintenancePage(
  propertyId: string,
  selectedMonth = new Date().toISOString().slice(0, 7),
): Promise<MaintenancePageView> {
  const locations = await getOperationsLocations(propertyId);
  if (!operationsSchemaReady()) {
    return {
      schemaReady: false,
      summary: { open: 0, inProgress: 0, urgent: 0, completedThisMonth: 0 },
      items: [],
      locations,
    };
  }

  const db = operationsDb();
  const issues = await db.maintenanceIssue!.findMany({
    where: { propertyId, archivedAt: null },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { reportedAt: "desc" }],
    include: {
      floor: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      expenses: {
        where: { archivedAt: null },
        orderBy: { expenseDate: "desc" },
      },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });

  const { start, end } = monthBounds(selectedMonth);
  const items: MaintenanceListItemView[] = issues.map((issue: any) =>
    mapMaintenance(issue),
  );
  return {
    schemaReady: true,
    summary: {
      open: items.filter((item) => item.status === "OPEN").length,
      inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
      urgent: items.filter(
        (item) =>
          item.priority === "URGENT" &&
          (item.status === "OPEN" || item.status === "IN_PROGRESS"),
      ).length,
      completedThisMonth: issues.filter(
        (issue: any) =>
          issue.status === "COMPLETED" &&
          issue.completedAt &&
          issue.completedAt >= start &&
          issue.completedAt < end,
      ).length,
    },
    items,
    locations,
  };
}

function mapMaintenance(issue: any): MaintenanceListItemView {
  const expenseTotal = (issue.expenses ?? []).reduce(
    (sum: bigint, expense: any) => addMoney(sum, expense.amount),
    BigInt(0),
  );
  const locationLabel = issue.space?.name
    ? `${issue.space.name}${issue.floor?.name ? ` · ${issue.floor.name}` : ""}`
    : issue.floor?.name || "Property";
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    reportedAt: toDateOnly(issue.reportedAt),
    reportedBy: issue.reportedBy ?? null,
    assignedTo: issue.assignedTo ?? null,
    floorId: issue.floorId ?? null,
    floorName: issue.floor?.name ?? null,
    spaceId: issue.spaceId ?? null,
    spaceName: issue.space?.name ?? null,
    locationLabel,
    notes: issue.notes ?? null,
    resolution: issue.resolution ?? null,
    completedAt: issue.completedAt ? toDateOnly(issue.completedAt) : null,
    costVnd: expenseTotal.toString(),
    photoCount: issue.photos?.length ?? 0,
    photos: (issue.photos ?? []).map((photo: any) => ({
      id: photo.id,
      url: `/api/operations/maintenance/${issue.id}/photos/${photo.id}`,
      createdAt: photo.createdAt.toISOString(),
    })),
    relatedExpenses: (issue.expenses ?? []).map((expense: any) => ({
      id: expense.id,
      expenseDate: toDateOnly(expense.expenseDate),
      category: expense.category,
      amountVnd: stringMoney(expense.amount),
      description: expense.description,
    })),
  };
}

export async function getExpensePage(
  propertyId: string,
  month: string,
): Promise<ExpensePageView> {
  const locations = await getOperationsLocations(propertyId);
  if (!operationsSchemaReady()) {
    return {
      schemaReady: false,
      summary: {
        totalVnd: "0",
        repairVnd: "0",
        utilitiesVnd: "0",
        otherVnd: "0",
        count: 0,
      },
      items: [],
      locations,
      maintenanceOptions: [],
      maintenanceItems: [],
    };
  }

  const db = operationsDb();
  const { start, end } = monthBounds(month);
  const [expenses, maintenance] = await Promise.all([
    db.expense!.findMany({
      where: {
        propertyId,
        archivedAt: null,
        expenseDate: { gte: start, lt: end },
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      include: {
        floor: { select: { id: true, name: true } },
        space: { select: { id: true, name: true } },
        maintenanceIssue: { select: { id: true, title: true } },
      },
    }),
    db.maintenanceIssue!.findMany({
      where: { propertyId, archivedAt: null },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { reportedAt: "desc" }],
      include: {
        floor: { select: { id: true, name: true } },
        space: { select: { id: true, name: true } },
        expenses: {
          where: { archivedAt: null },
          orderBy: { expenseDate: "desc" },
        },
        photos: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  let total = BigInt(0);
  let repair = BigInt(0);
  let utilities = BigInt(0);
  let other = BigInt(0);
  for (const expense of expenses) {
    total = addMoney(total, expense.amount);
    if (expense.category === "REPAIR") repair = addMoney(repair, expense.amount);
    else if (expense.category === "UTILITIES")
      utilities = addMoney(utilities, expense.amount);
    else other = addMoney(other, expense.amount);
  }

  return {
    schemaReady: true,
    summary: {
      totalVnd: total.toString(),
      repairVnd: repair.toString(),
      utilitiesVnd: utilities.toString(),
      otherVnd: other.toString(),
      count: expenses.length,
    },
    items: expenses.map((expense: any) => ({
      id: expense.id,
      expenseDate: toDateOnly(expense.expenseDate),
      category: expense.category as ExpenseCategory,
      description: expense.description,
      amountVnd: stringMoney(expense.amount),
      notes: expense.notes ?? null,
      floorId: expense.floorId ?? null,
      floorName: expense.floor?.name ?? null,
      spaceId: expense.spaceId ?? null,
      spaceName: expense.space?.name ?? null,
      locationLabel: expense.space?.name
        ? `${expense.space.name}${expense.floor?.name ? ` · ${expense.floor.name}` : ""}`
        : expense.floor?.name || "Property",
      maintenanceIssueId: expense.maintenanceIssueId ?? null,
      maintenanceTitle: expense.maintenanceIssue?.title ?? null,
      hasReceipt: Boolean(expense.receiptStorageKey),
      receiptMediaType: expense.receiptStorageKey
        ? expense.receiptStorageKey.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : "image"
        : null,
    })),
    locations,
    maintenanceOptions: maintenance.map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      locationLabel: issue.space?.name
        ? `${issue.space.name}${issue.floor?.name ? ` · ${issue.floor.name}` : ""}`
        : issue.floor?.name || "Property",
    })),
    maintenanceItems: maintenance.map((issue: any) => mapMaintenance(issue)),
  };
}

export async function getTaskPage(propertyId: string): Promise<TaskPageView> {
  const locations = await getOperationsLocations(propertyId);
  const invoiceOptions = await getInvoiceOptions(propertyId);
  if (!operationsSchemaReady()) {
    return {
      schemaReady: false,
      summary: { dueOrOverdue: 0, overdue: 0, upcoming: 0, completedThisMonth: 0 },
      items: [],
      locations,
      maintenanceOptions: [],
      invoiceOptions,
    };
  }

  const db = operationsDb();
  const [tasks, maintenance] = await Promise.all([
    db.task!.findMany({
      where: { propertyId, archivedAt: null },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    db.maintenanceIssue!.findMany({
      where: { propertyId, archivedAt: null },
      select: {
        id: true,
        title: true,
        floor: { select: { name: true } },
        space: { select: { name: true } },
      },
    }),
  ]);

  const today = new Date();
  const businessToday = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const monthStart = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), 1),
  );
  const nextMonth = new Date(
    Date.UTC(today.getFullYear(), today.getMonth() + 1, 1),
  );

  const spaceMap = new Map<string, string>(
    locations.map((location) => [
      location.spaceId,
      `${location.spaceName} · ${location.floorName}`,
    ]),
  );
  const maintenanceMap = new Map<string, string>(
    maintenance.map((issue: any) => [
      issue.id,
      `${issue.title}${issue.space?.name ? ` · ${issue.space.name}` : ""}`,
    ]),
  );
  const invoiceMap = new Map<string, string>(
    invoiceOptions.map((invoice) => [
      invoice.id,
      `${invoice.room} · ${invoice.billingMonth}`,
    ]),
  );

  const items: TaskPageView["items"] = tasks.map((task: any) => {
    const dueDate = task.dueDate ? toDateOnly(task.dueDate) : null;
    const overdue = Boolean(
      task.status === "TODO" && task.dueDate && task.dueDate < businessToday,
    );
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority,
      dueDate,
      linkedEntityType: task.linkedEntityType ?? null,
      linkedEntityId: task.linkedEntityId ?? null,
      linkedLabel: resolveTaskLinkLabel(
        task.linkedEntityType,
        task.linkedEntityId,
        spaceMap,
        maintenanceMap,
        invoiceMap,
      ),
      recurrenceUnit: task.recurrenceUnit ?? null,
      recurrenceInterval: task.recurrenceInterval ?? null,
      completedAt: task.completedAt ? toDateOnly(task.completedAt) : null,
      overdue,
    };
  });

  return {
    schemaReady: true,
    summary: {
      dueOrOverdue: items.filter(
        (task) =>
          task.status === "TODO" &&
          task.dueDate &&
          new Date(`${task.dueDate}T00:00:00Z`) <= businessToday,
      ).length,
      overdue: items.filter((task) => task.overdue).length,
      upcoming: items.filter(
        (task) =>
          task.status === "TODO" &&
          (!task.dueDate ||
            new Date(`${task.dueDate}T00:00:00Z`) > businessToday),
      ).length,
      completedThisMonth: tasks.filter(
        (task: any) =>
          task.status === "DONE" &&
          task.completedAt &&
          task.completedAt >= monthStart &&
          task.completedAt < nextMonth,
      ).length,
    },
    items,
    locations,
    maintenanceOptions: maintenance.map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      locationLabel: issue.space?.name
        ? `${issue.space.name}${issue.floor?.name ? ` · ${issue.floor.name}` : ""}`
        : issue.floor?.name || "Property",
    })),
    invoiceOptions,
  };
}

function resolveTaskLinkLabel(
  type: TaskLinkedEntityType | null,
  id: string | null,
  spaces: Map<string, string>,
  maintenance: Map<string, string>,
  invoices: Map<string, string>,
) {
  if (!type || !id) return null;
  if (type === "PROPERTY") return "Property";
  if (type === "SPACE") return spaces.get(id) ?? "Space";
  if (type === "MAINTENANCE") return maintenance.get(id) ?? "Maintenance issue";
  if (type === "INVOICE") return invoices.get(id) ?? "Invoice";
  return null;
}

async function getInvoiceOptions(
  propertyId: string,
): Promise<OperationsInvoiceOption[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      tenancy: { space: { floor: { propertyId } } },
    },
    orderBy: [{ billingPeriod: "desc" }, { createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      billingPeriod: true,
      roomNameSnapshot: true,
      renterNameSnapshot: true,
    },
  });
  return invoices.map((invoice) => ({
    id: invoice.id,
    room: invoice.roomNameSnapshot,
    renter: invoice.renterNameSnapshot,
    billingMonth: invoice.billingPeriod.toISOString().slice(0, 7),
  }));
}

export async function getSpaceMaintenanceSignals(
  propertyId: string,
): Promise<SpaceMaintenanceSignal[]> {
  if (!operationsSchemaReady()) return [];
  const db = operationsDb();
  const issues = await db.maintenanceIssue!.findMany({
    where: {
      propertyId,
      archivedAt: null,
      spaceId: { not: null },
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    select: { spaceId: true, priority: true },
  });
  const map = new Map<string, SpaceMaintenanceSignal>();
  for (const issue of issues) {
    if (!issue.spaceId) continue;
    const current = map.get(issue.spaceId) ?? {
      spaceId: issue.spaceId,
      openCount: 0,
      urgentCount: 0,
    };
    current.openCount += 1;
    if (issue.priority === "URGENT") current.urgentCount += 1;
    map.set(issue.spaceId, current);
  }
  return [...map.values()];
}

export async function getExpenseReceiptStorageKey(expenseId: string) {
  if (!operationsSchemaReady()) return null;
  const db = operationsDb();
  const expense = await db.expense!.findUnique({
    where: { id: expenseId },
    select: { receiptStorageKey: true },
  });
  return expense?.receiptStorageKey ?? null;
}

export async function getMaintenancePhotoStorageKey(issueId: string, photoId: string) {
  if (!operationsSchemaReady()) return null;
  const db = operationsDb();
  const photo = await db.maintenancePhoto!.findFirst({
    where: { id: photoId, maintenanceIssueId: issueId },
    select: { storageKey: true },
  });
  return photo?.storageKey ?? null;
}
