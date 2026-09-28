"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import {
  installMeter,
  appendMeterReadingPhoto,
  markAllEligibleMonthlyClosings,
  markReadingAsMonthlyClosing,
  recordMissingBoundary,
  recordReading,
  replaceMeter,
  saveMonthlyReading,
  updateMeterReading,
} from "./server/meter.service";
import { addRate, setElectricityOverride } from "./server/utility-rate.service";
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const file = (data: FormData, key: string) => {
  const value = data.get(key);
  return value instanceof File && value.size ? value : undefined;
};
async function action(
  work: () => Promise<unknown>,
  success: string,
): Promise<ActionState> {
  try {
    await work();
    revalidatePath("/utilities");
    revalidatePath("/utilities/meters");
    revalidatePath("/utilities/rates");
    revalidatePath("/");
    return { ok: true, message: success };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not save utilities.",
    };
  }
}
export async function installMeterAction(_: ActionState, data: FormData) {
  return action(
    () =>
      installMeter({
        spaceId: text(data, "spaceId"),
        meterNumber: text(data, "meterNumber") || undefined,
        installedAt: text(data, "installedAt"),
        initialReading: text(data, "initialReading"),
        photo: file(data, "photo"),
        notes: text(data, "notes") || undefined,
      }),
    "Meter installed.",
  );
}
export async function recordReadingAction(_: ActionState, data: FormData) {
  return action(
    () =>
      recordReading({
        meterId: text(data, "meterId"),
        billingMonth: text(data, "billingMonth") || undefined,
        readingDate: text(data, "readingDate"),
        readingValue: text(data, "readingValue"),
        readingType: "MANUAL",
        source: (text(data, "source") || "MEASURED") as
          "MEASURED" | "ESTIMATED",
        reason: text(data, "reason") || undefined,
        photo: file(data, "photo"),
        notes: text(data, "notes") || undefined,
      }),
    "Reading recorded.",
  );
}

export async function markReadingAsMonthlyClosingAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      markReadingAsMonthlyClosing({
        meterId: text(data, "meterId"),
        readingId: text(data, "readingId"),
        billingMonth: text(data, "billingMonth"),
      }),
    "Monthly closing set.",
  );
}

export async function markAllEligibleMonthlyClosingsAction(
  _: ActionState,
  data: FormData,
) {
  const rawAssignments = text(data, "assignments");
  let assignments: Array<{ meterId: string; readingId: string }> = [];
  try {
    assignments = rawAssignments ? JSON.parse(rawAssignments) : [];
  } catch {
    return { ok: false, message: "Could not read the selected closing readings." };
  }
  return action(
    () =>
      markAllEligibleMonthlyClosings({
        propertyId: text(data, "propertyId"),
        billingMonth: text(data, "billingMonth"),
        assignments,
      }),
    "Current readings set as monthly closings.",
  );
}

export async function updateMeterReadingAction(_: ActionState, data: FormData) {
  return action(
    () =>
      updateMeterReading({
        readingId: text(data, "readingId"),
        readingDate: text(data, "readingDate"),
        readingValue: text(data, "readingValue"),
        source: text(data, "source") as "MEASURED" | "ESTIMATED",
        reason: text(data, "reason") || undefined,
        photo: file(data, "photo"),
      }),
    "Reading updated.",
  );
}

export async function appendMeterReadingPhotoAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () => appendMeterReadingPhoto(text(data, "readingId"), file(data, "photo")),
    "Evidence photo added.",
  );
}
export async function recordMissingBoundaryAction(
  _: ActionState,
  data: FormData,
) {
  return action(
    () =>
      recordMissingBoundary({
        tenancyId: text(data, "tenancyId"),
        boundaryType: text(data, "boundaryType") as "MOVE_IN" | "MOVE_OUT",
        readingValue: text(data, "readingValue"),
        source: text(data, "source") as "MEASURED" | "ESTIMATED",
        reason: text(data, "reason") || undefined,
        photo: file(data, "photo"),
        notes: text(data, "notes") || undefined,
      }),
    "Boundary reading recorded.",
  );
}
export async function saveMonthlyReadingAction(_: ActionState, data: FormData) {
  return action(
    () =>
      saveMonthlyReading({
        meterId: text(data, "meterId"),
        billingMonth: text(data, "billingMonth"),
        readingDate: text(data, "readingDate"),
        readingValue: text(data, "readingValue"),
        source: text(data, "source") as "MEASURED" | "ESTIMATED",
        reason: text(data, "reason") || undefined,
        photo: file(data, "photo"),
        notes: text(data, "notes") || undefined,
      }),
    "Manual reading recorded and assigned as the monthly closing.",
  );
}
export async function replaceMeterAction(_: ActionState, data: FormData) {
  return action(
    () =>
      replaceMeter({
        spaceId: text(data, "spaceId"),
        replacementDate: text(data, "replacementDate"),
        oldMeterFinalReading: text(data, "oldMeterFinalReading") || null,
        oldMeterFinalReadingSource: text(data, "oldMeterFinalReadingSource") as
          "MEASURED" | "ESTIMATED",
        oldMeterPhoto: file(data, "oldMeterPhoto"),
        newMeterNumber: text(data, "newMeterNumber") || undefined,
        newMeterInitialReading: text(data, "newMeterInitialReading"),
        newMeterPhoto: file(data, "newMeterPhoto"),
        reason: text(data, "reason"),
        notes: text(data, "notes") || undefined,
      }),
    "Meter replaced.",
  );
}
export async function saveRateAction(_: ActionState, data: FormData) {
  return action(
    () =>
      addRate({
        propertyId: text(data, "propertyId"),
        utilityType: text(data, "utilityType") as "ELECTRICITY" | "WATER",
        rate: text(data, "rate"),
        effectiveFrom: text(data, "effectiveFrom"),
        notes: text(data, "notes") || undefined,
      }),
    "Rate saved.",
  );
}
export async function saveOverrideAction(_: ActionState, data: FormData) {
  return action(
    () =>
      setElectricityOverride({
        spaceId: text(data, "spaceId"),
        billingMonth: text(data, "billingMonth"),
        rate: text(data, "rate"),
        reason: text(data, "reason"),
      }),
    "Room rate override saved.",
  );
}
