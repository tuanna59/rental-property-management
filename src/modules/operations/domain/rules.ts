import type { TaskRecurrenceUnit } from "./types";

/** Add recurrence from the previous due date so completion timing never causes drift. */
export function nextRecurringDueDate(
  previousDueDate: Date,
  interval: number,
  unit: TaskRecurrenceUnit,
) {
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("Recurrence interval must be a positive whole number.");
  }

  const year = previousDueDate.getUTCFullYear();
  const month = previousDueDate.getUTCMonth();
  const day = previousDueDate.getUTCDate();

  if (unit === "DAYS") {
    const result = new Date(previousDueDate);
    result.setUTCDate(result.getUTCDate() + interval);
    return result;
  }

  if (unit === "YEARS") {
    const targetYear = year + interval;
    const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, month, Math.min(day, lastDay)));
  }

  const targetMonthIndex = month + interval;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)),
  );
}
