import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { positiveWholeVnd } from "@/lib/money";
import { date, requiredText } from "@/modules/utilities/domain/validation";

import {
  EXPENSE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  TASK_LINK_TYPES,
  TASK_PRIORITIES,
  TASK_RECURRENCE_UNITS,
  type ExpenseCategory,
  type MaintenancePriority,
  type TaskLinkedEntityType,
  type TaskPriority,
  type TaskRecurrenceUnit,
} from "../domain/types";
import { nextRecurringDueDate } from "../domain/rules";
import { operationsDb, requireOperationsSchema } from "./operations-db";
import {
  removePrivateOperationFile,
  storeExpenseReceipt,
  storeMaintenancePhoto,
} from "./private-media";

type LocationInput = {
  propertyId: string;
  floorId?: string | null;
  spaceId?: string | null;
};

type ExpenseInput = LocationInput & {
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  maintenanceIssueId?: string | null;
  notes?: string | null;
  receipt?: File | null;
};

type MaintenanceInput = LocationInput & {
  title: string;
  description: string;
  priority: MaintenancePriority;
  reportedAt: string;
  reportedBy?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
  photos?: File[];
};

type TaskInput = {
  propertyId: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  linkedEntityType?: TaskLinkedEntityType | null;
  linkedEntityId?: string | null;
  recurrenceUnit?: TaskRecurrenceUnit | null;
  recurrenceInterval?: number | null;
};

function enumValue<T extends readonly string[]>(
  value: string,
  options: T,
  message: string,
): T[number] {
  if (!(options as readonly string[]).includes(value)) throw new Error(message);
  return value as T[number];
}

async function validateLocation(input: LocationInput) {
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, archivedAt: null },
    select: { id: true },
  });
  if (!property) throw new Error("Property was not found.");

  let floorId = input.floorId || null;
  let spaceId = input.spaceId || null;
  if (spaceId) {
    const space = await prisma.space.findFirst({
      where: {
        id: spaceId,
        archivedAt: null,
        floor: { propertyId: input.propertyId, archivedAt: null },
      },
      select: { id: true, floorId: true },
    });
    if (!space) throw new Error("Selected room does not belong to this property.");
    floorId = space.floorId;
  } else if (floorId) {
    const floor = await prisma.floor.findFirst({
      where: { id: floorId, propertyId: input.propertyId, archivedAt: null },
      select: { id: true },
    });
    if (!floor) throw new Error("Selected floor does not belong to this property.");
  }

  return { floorId, spaceId };
}

async function validateMaintenanceLink(propertyId: string, id?: string | null) {
  if (!id) return null;
  const db = requireOperationsSchema();
  const issue = await db.maintenanceIssue!.findFirst({
    where: { id, propertyId, archivedAt: null },
    select: { id: true },
  });
  if (!issue) throw new Error("Linked maintenance issue was not found.");
  return id;
}

export async function createExpense(input: ExpenseInput) {
  const db = requireOperationsSchema();
  const location = await validateLocation(input);
  const category = enumValue(input.category, EXPENSE_CATEGORIES, "Choose an expense category.");
  const maintenanceIssueId = await validateMaintenanceLink(
    input.propertyId,
    input.maintenanceIssueId,
  );
  const id = randomUUID();
  let receiptStorageKey: string | null = null;

  try {
    if (input.receipt && input.receipt.size > 0) {
      receiptStorageKey = await storeExpenseReceipt(
        input.propertyId,
        id,
        input.receipt,
      );
    }
    return await db.expense!.create({
      data: {
        id,
        propertyId: input.propertyId,
        floorId: location.floorId,
        spaceId: location.spaceId,
        maintenanceIssueId,
        expenseDate: date(input.expenseDate),
        category,
        description: requiredText(input.description, "Description is required."),
        amount: positiveWholeVnd(input.amount),
        receiptStorageKey,
        notes: input.notes?.trim() || null,
      },
    });
  } catch (error) {
    await removePrivateOperationFile(receiptStorageKey);
    throw error;
  }
}

export async function updateExpense(expenseId: string, input: ExpenseInput) {
  const db = requireOperationsSchema();
  const existing = await db.expense!.findFirst({
    where: { id: expenseId, propertyId: input.propertyId, archivedAt: null },
  });
  if (!existing) throw new Error("Expense was not found.");

  const location = await validateLocation(input);
  const category = enumValue(input.category, EXPENSE_CATEGORIES, "Choose an expense category.");
  const maintenanceIssueId = await validateMaintenanceLink(
    input.propertyId,
    input.maintenanceIssueId,
  );
  let nextReceipt = existing.receiptStorageKey as string | null;
  let storedNewReceipt: string | null = null;
  if (input.receipt && input.receipt.size > 0) {
    storedNewReceipt = await storeExpenseReceipt(
      input.propertyId,
      expenseId,
      input.receipt,
    );
    nextReceipt = storedNewReceipt;
  }

  try {
    const result = await db.expense!.update({
      where: { id: expenseId },
      data: {
        floorId: location.floorId,
        spaceId: location.spaceId,
        maintenanceIssueId,
        expenseDate: date(input.expenseDate),
        category,
        description: requiredText(input.description, "Description is required."),
        amount: positiveWholeVnd(input.amount),
        receiptStorageKey: nextReceipt,
        notes: input.notes?.trim() || null,
      },
    });
    if (storedNewReceipt && existing.receiptStorageKey) {
      await removePrivateOperationFile(existing.receiptStorageKey);
    }
    return result;
  } catch (error) {
    await removePrivateOperationFile(storedNewReceipt);
    throw error;
  }
}

export async function archiveExpense(expenseId: string) {
  const db = requireOperationsSchema();
  return db.expense!.update({
    where: { id: expenseId },
    data: { archivedAt: new Date() },
  });
}

export async function removeExpenseReceipt(expenseId: string) {
  const db = requireOperationsSchema();
  const expense = await db.expense!.findUnique({ where: { id: expenseId } });
  if (!expense) throw new Error("Expense was not found.");
  await db.expense!.update({
    where: { id: expenseId },
    data: { receiptStorageKey: null },
  });
  await removePrivateOperationFile(expense.receiptStorageKey);
}

export async function createMaintenanceIssue(input: MaintenanceInput) {
  const db = requireOperationsSchema();
  const location = await validateLocation(input);
  const priority = enumValue(
    input.priority,
    MAINTENANCE_PRIORITIES,
    "Choose a maintenance priority.",
  );
  const id = randomUUID();
  const stored: string[] = [];

  try {
    for (const file of input.photos ?? []) {
      if (!file || file.size === 0) continue;
      stored.push(await storeMaintenancePhoto(input.propertyId, id, file));
    }
    return await db.maintenanceIssue!.create({
      data: {
        id,
        propertyId: input.propertyId,
        floorId: location.floorId,
        spaceId: location.spaceId,
        title: requiredText(input.title, "Issue title is required."),
        description: requiredText(input.description, "Issue description is required."),
        status: "OPEN",
        priority,
        reportedAt: date(input.reportedAt),
        reportedBy: input.reportedBy?.trim() || null,
        assignedTo: input.assignedTo?.trim() || null,
        notes: input.notes?.trim() || null,
        photos: stored.length
          ? { create: stored.map((storageKey) => ({ storageKey })) }
          : undefined,
      },
    });
  } catch (error) {
    await Promise.all(stored.map((key) => removePrivateOperationFile(key)));
    throw error;
  }
}

export async function updateMaintenanceIssue(
  issueId: string,
  input: Omit<MaintenanceInput, "photos">,
) {
  const db = requireOperationsSchema();
  const issue = await db.maintenanceIssue!.findFirst({
    where: { id: issueId, propertyId: input.propertyId, archivedAt: null },
  });
  if (!issue) throw new Error("Maintenance issue was not found.");
  if (issue.status === "COMPLETED") {
    throw new Error("Completed maintenance is read-only.");
  }
  const location = await validateLocation(input);
  return db.maintenanceIssue!.update({
    where: { id: issueId },
    data: {
      floorId: location.floorId,
      spaceId: location.spaceId,
      title: requiredText(input.title, "Issue title is required."),
      description: requiredText(input.description, "Issue description is required."),
      priority: enumValue(
        input.priority,
        MAINTENANCE_PRIORITIES,
        "Choose a maintenance priority.",
      ),
      reportedAt: date(input.reportedAt),
      reportedBy: input.reportedBy?.trim() || null,
      assignedTo: input.assignedTo?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function startMaintenanceIssue(issueId: string, assignedTo?: string) {
  const db = requireOperationsSchema();
  const issue = await db.maintenanceIssue!.findUnique({ where: { id: issueId } });
  if (!issue || issue.archivedAt) throw new Error("Maintenance issue was not found.");
  if (issue.status !== "OPEN") throw new Error("Only open issues can be started.");
  return db.maintenanceIssue!.update({
    where: { id: issueId },
    data: {
      status: "IN_PROGRESS",
      assignedTo: assignedTo?.trim() || issue.assignedTo || null,
    },
  });
}

export async function completeMaintenanceIssue(input: {
  issueId: string;
  resolution: string;
  completedAt: string;
  cost?: string | null;
  expenseCategory?: ExpenseCategory | null;
  expenseDate?: string | null;
  expenseDescription?: string | null;
  expenseNotes?: string | null;
}) {
  requireOperationsSchema();
  const resolution = requiredText(input.resolution, "Resolution is required.");
  const completedAt = date(input.completedAt);
  const hasCost = Boolean(input.cost?.trim());
  const amount = hasCost ? positiveWholeVnd(input.cost!.trim()) : null;
  const category = hasCost
    ? enumValue(
        input.expenseCategory || "REPAIR",
        EXPENSE_CATEGORIES,
        "Choose an expense category.",
      )
    : null;

  return prisma.$transaction(async (tx) => {
    const db = requireOperationsSchema(tx);
    const issue = await db.maintenanceIssue!.findUnique({
      where: { id: input.issueId },
    });
    if (!issue || issue.archivedAt) throw new Error("Maintenance issue was not found.");
    if (issue.status === "COMPLETED") throw new Error("Maintenance issue is already completed.");

    const completed = await db.maintenanceIssue!.update({
      where: { id: input.issueId },
      data: { status: "COMPLETED", resolution, completedAt },
    });

    if (amount) {
      await db.expense!.create({
        data: {
          id: randomUUID(),
          propertyId: issue.propertyId,
          floorId: issue.floorId,
          spaceId: issue.spaceId,
          maintenanceIssueId: issue.id,
          expenseDate: date(input.expenseDate || input.completedAt),
          category,
          description:
            input.expenseDescription?.trim() || `Maintenance: ${issue.title}`,
          amount,
          notes: input.expenseNotes?.trim() || null,
        },
      });
    }

    return completed;
  });
}

export async function archiveMaintenanceIssue(issueId: string) {
  const db = requireOperationsSchema();
  return db.maintenanceIssue!.update({
    where: { id: issueId },
    data: { archivedAt: new Date() },
  });
}

export async function addMaintenancePhotos(
  issueId: string,
  propertyId: string,
  files: File[],
) {
  const db = requireOperationsSchema();
  const issue = await db.maintenanceIssue!.findFirst({
    where: { id: issueId, propertyId, archivedAt: null },
  });
  if (!issue) throw new Error("Maintenance issue was not found.");
  const stored: string[] = [];
  try {
    for (const file of files) {
      if (!file || file.size === 0) continue;
      stored.push(await storeMaintenancePhoto(propertyId, issueId, file));
    }
    if (!stored.length) throw new Error("Choose at least one photo.");
    return await db.maintenancePhoto!.createMany({
      data: stored.map((storageKey) => ({
        id: randomUUID(),
        maintenanceIssueId: issueId,
        storageKey,
      })),
    });
  } catch (error) {
    await Promise.all(stored.map((key) => removePrivateOperationFile(key)));
    throw error;
  }
}

export async function removeMaintenancePhoto(issueId: string, photoId: string) {
  const db = requireOperationsSchema();
  const photo = await db.maintenancePhoto!.findFirst({
    where: { id: photoId, maintenanceIssueId: issueId },
  });
  if (!photo) throw new Error("Photo was not found.");
  await db.maintenancePhoto!.delete({ where: { id: photoId } });
  await removePrivateOperationFile(photo.storageKey);
}

export async function createTask(input: TaskInput) {
  const db = requireOperationsSchema();
  await validateTaskInput(input);
  return db.task!.create({
    data: {
      id: randomUUID(),
      propertyId: input.propertyId,
      title: requiredText(input.title, "Task title is required."),
      description: input.description?.trim() || null,
      status: "TODO",
      priority: enumValue(input.priority, TASK_PRIORITIES, "Choose a task priority."),
      dueDate: input.dueDate ? date(input.dueDate) : null,
      linkedEntityType: input.linkedEntityType || null,
      linkedEntityId: input.linkedEntityId || null,
      recurrenceUnit: input.recurrenceUnit || null,
      recurrenceInterval: input.recurrenceUnit ? input.recurrenceInterval : null,
    },
  });
}

export async function updateTask(taskId: string, input: TaskInput) {
  const db = requireOperationsSchema();
  const task = await db.task!.findFirst({
    where: { id: taskId, propertyId: input.propertyId, archivedAt: null },
  });
  if (!task) throw new Error("Task was not found.");
  if (task.status === "DONE") throw new Error("Completed tasks are historical and read-only.");
  await validateTaskInput(input);
  return db.task!.update({
    where: { id: taskId },
    data: {
      title: requiredText(input.title, "Task title is required."),
      description: input.description?.trim() || null,
      priority: enumValue(input.priority, TASK_PRIORITIES, "Choose a task priority."),
      dueDate: input.dueDate ? date(input.dueDate) : null,
      linkedEntityType: input.linkedEntityType || null,
      linkedEntityId: input.linkedEntityId || null,
      recurrenceUnit: input.recurrenceUnit || null,
      recurrenceInterval: input.recurrenceUnit ? input.recurrenceInterval : null,
    },
  });
}

async function validateTaskInput(input: TaskInput) {
  enumValue(input.priority, TASK_PRIORITIES, "Choose a task priority.");
  if (input.recurrenceUnit) {
    enumValue(input.recurrenceUnit, TASK_RECURRENCE_UNITS, "Choose a recurrence unit.");
    if (!input.dueDate) throw new Error("A due date is required for recurring tasks.");
    if (!input.recurrenceInterval || input.recurrenceInterval < 1) {
      throw new Error("Recurrence interval must be at least 1.");
    }
  }
  if (input.linkedEntityType) {
    enumValue(input.linkedEntityType, TASK_LINK_TYPES, "Choose a valid linked context.");
    if (!input.linkedEntityId) throw new Error("Choose the linked record.");
    await validateTaskLink(input.propertyId, input.linkedEntityType, input.linkedEntityId);
  }
}

async function validateTaskLink(
  propertyId: string,
  type: TaskLinkedEntityType,
  id: string,
) {
  if (type === "PROPERTY") {
    if (id !== propertyId) throw new Error("Linked property is invalid.");
    return;
  }
  if (type === "SPACE") {
    const space = await prisma.space.findFirst({
      where: { id, floor: { propertyId }, archivedAt: null },
      select: { id: true },
    });
    if (!space) throw new Error("Linked room was not found.");
    return;
  }
  if (type === "INVOICE") {
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenancy: { space: { floor: { propertyId } } } },
      select: { id: true },
    });
    if (!invoice) throw new Error("Linked invoice was not found.");
    return;
  }
  const db = requireOperationsSchema();
  const issue = await db.maintenanceIssue!.findFirst({
    where: { id, propertyId, archivedAt: null },
    select: { id: true },
  });
  if (!issue) throw new Error("Linked maintenance issue was not found.");
}

export async function completeTask(taskId: string) {
  requireOperationsSchema();
  return prisma.$transaction(async (tx) => {
    const db = requireOperationsSchema(tx);
    const task = await db.task!.findUnique({ where: { id: taskId } });
    if (!task || task.archivedAt) throw new Error("Task was not found.");
    if (task.status === "DONE") return task;

    const completedAt = new Date();
    const completed = await db.task!.update({
      where: { id: taskId },
      data: { status: "DONE", completedAt },
    });

    if (task.recurrenceUnit && task.recurrenceInterval && task.dueDate) {
      const existingNext = await db.task!.findFirst({
        where: { previousOccurrenceId: task.id },
      });
      if (!existingNext) {
        const nextDue = nextRecurringDueDate(
          task.dueDate,
          task.recurrenceInterval,
          task.recurrenceUnit,
        );
        await db.task!.create({
          data: {
            id: randomUUID(),
            propertyId: task.propertyId,
            title: task.title,
            description: task.description,
            status: "TODO",
            priority: task.priority,
            dueDate: nextDue,
            linkedEntityType: task.linkedEntityType,
            linkedEntityId: task.linkedEntityId,
            recurrenceUnit: task.recurrenceUnit,
            recurrenceInterval: task.recurrenceInterval,
            previousOccurrenceId: task.id,
          },
        });
      }
    }

    return completed;
  });
}

export async function archiveTask(taskId: string) {
  const db = requireOperationsSchema();
  return db.task!.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });
}
