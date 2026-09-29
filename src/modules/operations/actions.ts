"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { getActionFeedback } from "@/i18n/action-feedback";

import type {
  ExpenseCategory,
  MaintenancePriority,
  TaskLinkedEntityType,
  TaskPriority,
  TaskRecurrenceUnit,
} from "./domain/types";
import {
  addMaintenancePhotos,
  archiveExpense,
  archiveMaintenanceIssue,
  archiveTask,
  completeMaintenanceIssue,
  completeTask,
  createExpense,
  createMaintenanceIssue,
  createTask,
  removeExpenseReceipt,
  removeMaintenancePhoto,
  startMaintenanceIssue,
  updateExpense,
  updateMaintenanceIssue,
  updateTask,
} from "./server/operations.service";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => text(data, key) || undefined;
const file = (data: FormData, key: string) => {
  const value = data.get(key);
  return value instanceof File && value.size > 0 ? value : undefined;
};
const files = (data: FormData, key: string) =>
  data.getAll(key).filter((value): value is File => value instanceof File && value.size > 0);

function revalidateOperations() {
  revalidatePath("/operations/maintenance");
  revalidatePath("/operations/tasks");
  revalidatePath("/operations/expenses");
  revalidatePath("/");
}

async function action(work: () => Promise<unknown>, successKey: string): Promise<ActionState> {
  const feedback = await getActionFeedback("operations");
  try {
    await work();
    revalidateOperations();
    return { ok: true, message: feedback(successKey) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : feedback("saveFailed"),
    };
  }
}

export async function createExpenseAction(_: ActionState, data: FormData) {
  return action(
    () =>
      createExpense({
        propertyId: text(data, "propertyId"),
        floorId: optional(data, "floorId"),
        spaceId: optional(data, "spaceId"),
        maintenanceIssueId: optional(data, "maintenanceIssueId"),
        assetId: optional(data, "assetId"),
        expenseDate: text(data, "expenseDate"),
        category: text(data, "category") as ExpenseCategory,
        description: text(data, "description"),
        amount: text(data, "amount"),
        notes: optional(data, "notes"),
        receipt: file(data, "receipt"),
      }),
    "expenseRecorded",
  );
}

export async function updateExpenseAction(_: ActionState, data: FormData) {
  return action(
    () =>
      updateExpense(text(data, "expenseId"), {
        propertyId: text(data, "propertyId"),
        floorId: optional(data, "floorId"),
        spaceId: optional(data, "spaceId"),
        maintenanceIssueId: optional(data, "maintenanceIssueId"),
        assetId: optional(data, "assetId"),
        expenseDate: text(data, "expenseDate"),
        category: text(data, "category") as ExpenseCategory,
        description: text(data, "description"),
        amount: text(data, "amount"),
        notes: optional(data, "notes"),
        receipt: file(data, "receipt"),
      }),
    "expenseUpdated",
  );
}

export async function archiveExpenseAction(_: ActionState, data: FormData) {
  return action(() => archiveExpense(text(data, "expenseId")), "expenseArchived");
}

export async function removeExpenseReceiptAction(_: ActionState, data: FormData) {
  return action(
    () => removeExpenseReceipt(text(data, "expenseId")),
    "receiptRemoved",
  );
}

export async function createMaintenanceAction(_: ActionState, data: FormData) {
  return action(
    () =>
      createMaintenanceIssue({
        propertyId: text(data, "propertyId"),
        floorId: optional(data, "floorId"),
        spaceId: optional(data, "spaceId"),
        assetId: optional(data, "assetId"),
        title: text(data, "title"),
        description: text(data, "description"),
        priority: text(data, "priority") as MaintenancePriority,
        reportedAt: text(data, "reportedAt"),
        reportedBy: optional(data, "reportedBy"),
        assignedTo: optional(data, "assignedTo"),
        notes: optional(data, "notes"),
        photos: files(data, "photos"),
      }),
    "issueReported",
  );
}

export async function updateMaintenanceAction(_: ActionState, data: FormData) {
  return action(
    () =>
      updateMaintenanceIssue(text(data, "issueId"), {
        propertyId: text(data, "propertyId"),
        floorId: optional(data, "floorId"),
        spaceId: optional(data, "spaceId"),
        assetId: optional(data, "assetId"),
        title: text(data, "title"),
        description: text(data, "description"),
        priority: text(data, "priority") as MaintenancePriority,
        reportedAt: text(data, "reportedAt"),
        reportedBy: optional(data, "reportedBy"),
        assignedTo: optional(data, "assignedTo"),
        notes: optional(data, "notes"),
      }),
    "issueUpdated",
  );
}

export async function startMaintenanceAction(_: ActionState, data: FormData) {
  return action(
    () => startMaintenanceIssue(text(data, "issueId"), optional(data, "assignedTo")),
    "workStarted",
  );
}

export async function completeMaintenanceAction(_: ActionState, data: FormData) {
  return action(
    () =>
      completeMaintenanceIssue({
        issueId: text(data, "issueId"),
        resolution: text(data, "resolution"),
        completedAt: text(data, "completedAt"),
        cost: optional(data, "cost"),
        expenseCategory: optional(data, "expenseCategory") as ExpenseCategory | undefined,
        expenseDate: optional(data, "expenseDate"),
        expenseDescription: optional(data, "expenseDescription"),
        expenseNotes: optional(data, "expenseNotes"),
      }),
    "issueCompleted",
  );
}

export async function archiveMaintenanceAction(_: ActionState, data: FormData) {
  return action(
    () => archiveMaintenanceIssue(text(data, "issueId")),
    "issueArchived",
  );
}

export async function addMaintenancePhotosAction(_: ActionState, data: FormData) {
  return action(
    () =>
      addMaintenancePhotos(
        text(data, "issueId"),
        text(data, "propertyId"),
        files(data, "photos"),
      ),
    "photosAdded",
  );
}

export async function removeMaintenancePhotoAction(_: ActionState, data: FormData) {
  return action(
    () => removeMaintenancePhoto(text(data, "issueId"), text(data, "photoId")),
    "photoRemoved",
  );
}

function taskInput(data: FormData) {
  const recurrenceUnit = optional(data, "recurrenceUnit") as TaskRecurrenceUnit | undefined;
  const linkedEntityType = optional(data, "linkedEntityType") as TaskLinkedEntityType | undefined;
  return {
    propertyId: text(data, "propertyId"),
    title: text(data, "title"),
    description: optional(data, "description"),
    priority: text(data, "priority") as TaskPriority,
    dueDate: optional(data, "dueDate"),
    linkedEntityType,
    linkedEntityId: linkedEntityType === "PROPERTY" ? text(data, "propertyId") : optional(data, "linkedEntityId"),
    recurrenceUnit,
    recurrenceInterval: recurrenceUnit ? Number(text(data, "recurrenceInterval")) : undefined,
  };
}

export async function createTaskAction(_: ActionState, data: FormData) {
  return action(() => createTask(taskInput(data)), "taskCreated");
}

export async function updateTaskAction(_: ActionState, data: FormData) {
  return action(
    () => updateTask(text(data, "taskId"), taskInput(data)),
    "taskUpdated",
  );
}

export async function completeTaskAction(_: ActionState, data: FormData) {
  return action(() => completeTask(text(data, "taskId")), "taskCompleted");
}

export async function archiveTaskAction(_: ActionState, data: FormData) {
  return action(() => archiveTask(text(data, "taskId")), "taskArchived");
}
