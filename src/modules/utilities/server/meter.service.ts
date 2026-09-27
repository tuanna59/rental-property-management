import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";
import { assertReadingDoesNotDecrease, monthStart } from "../domain/rules";
import { date, reading, requiredText } from "../domain/validation";
import type {
  InstallMeterInput,
  RecordReadingInput,
  ReplaceMeterInput,
  RecordMissingBoundaryInput,
  SaveMonthlyReadingInput,
} from "../domain/types";
import { saveMeterPhoto } from "./meter-media";

async function activeMeter(
  tx: Prisma.TransactionClient,
  spaceId: string,
  at: Date,
) {
  return tx.meter.findFirst({
    where: {
      spaceId,
      type: "ELECTRICITY",
      installedAt: { lte: at },
      OR: [{ removedAt: null }, { removedAt: { gt: at } }],
    },
    select: { id: true },
  });
}

export async function installMeter(input: InstallMeterInput) {
  const installedAt = date(input.installedAt),
    initialReading = new Prisma.Decimal(reading(input.initialReading));
  return tenancyTransaction(async (tx) => {
    if (await activeMeter(tx, input.spaceId, installedAt))
      throw new Error(
        "This room already has an active electricity meter on that date.",
      );
    const meter = await tx.meter.create({
      data: {
        spaceId: input.spaceId,
        type: "ELECTRICITY",
        meterNumber: input.meterNumber || null,
        installedAt,
        notes: input.notes || null,
      },
      select: { id: true },
    });
    const photoStorageKey = await saveMeterPhoto(meter.id, input.photo);
    await tx.meterReading.create({
      data: {
        meterId: meter.id,
        readingDate: installedAt,
        readingValue: initialReading,
        readingType: "METER_INSTALL",
        source: "MEASURED",
        photoStorageKey,
        notes: input.notes || null,
      },
    });
    return meter;
  });
}

export async function recordReading(input: RecordReadingInput) {
  if (input.readingType !== "MANUAL") {
    throw new Error(
      "Use the monthly or lifecycle workflow for this reading type.",
    );
  }
  const readingDate = date(input.readingDate),
    readingValue = new Prisma.Decimal(reading(input.readingValue));
  if (input.source === "ESTIMATED")
    requiredText(input.reason || "", "Estimated readings require a reason.");
  return tenancyTransaction(async (tx) => {
    const meter = await tx.meter.findUnique({
      where: { id: input.meterId },
      select: { id: true },
    });
    if (!meter) throw new Error("The selected meter was not found.");
    if (input.source === "MEASURED") {
      const [prior, next] = await Promise.all([
        tx.meterReading.findFirst({
          where: { meterId: meter.id, readingDate: { lte: readingDate } },
          orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
          select: { readingValue: true },
        }),
        tx.meterReading.findFirst({
          where: { meterId: meter.id, readingDate: { gte: readingDate } },
          orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
          select: { readingValue: true },
        }),
      ]);
      assertReadingDoesNotDecrease(prior?.readingValue ?? null, readingValue);
      if (next && readingValue.greaterThan(next.readingValue)) {
        throw new Error(
          "The reading cannot be higher than the next reading on this meter.",
        );
      }
    }
    const photoStorageKey = await saveMeterPhoto(meter.id, input.photo);
    return tx.meterReading.create({
      data: {
        meterId: meter.id,
        readingDate,
        readingValue,
        readingType: input.readingType,
        source: input.source,
        photoStorageKey,
        notes: input.notes || null,
        reason: input.reason || null,
      },
    });
  });
}

export async function saveMonthlyReading(input: SaveMonthlyReadingInput) {
  const billingMonth = monthStart(date(input.billingMonth));
  const readingDate = date(input.readingDate);
  const readingValue = new Prisma.Decimal(reading(input.readingValue));
  if (readingDate < billingMonth) {
    throw new Error(
      "The reading date cannot be before the selected billing month.",
    );
  }
  if (input.source === "ESTIMATED") {
    requiredText(input.reason || "", "Estimated readings require a reason.");
  }

  return tenancyTransaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Meter" WHERE "id" = ${input.meterId} FOR UPDATE
    `);
    const meter = await tx.meter.findUnique({
      where: { id: input.meterId },
      select: { id: true, installedAt: true, removedAt: true },
    });
    if (!meter) throw new Error("The selected meter was not found.");
    if (
      readingDate < meter.installedAt ||
      (meter.removedAt && readingDate > meter.removedAt)
    ) {
      throw new Error(
        "The reading date is outside this meter's active period.",
      );
    }

    const existing = await tx.meterReading.findUnique({
      where: { meterId_billingMonth: { meterId: meter.id, billingMonth } },
      select: { id: true, photoStorageKey: true },
    });
    const neighbors = await tx.meterReading.findMany({
      where: {
        meterId: meter.id,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
      select: { readingDate: true, readingValue: true },
    });
    const previous = neighbors
      .filter((item) => item.readingDate <= readingDate)
      .at(-1);
    const next = neighbors.find((item) => item.readingDate >= readingDate);
    assertReadingDoesNotDecrease(previous?.readingValue ?? null, readingValue);
    if (next && readingValue.greaterThan(next.readingValue)) {
      throw new Error(
        "The reading cannot be higher than the next reading on this meter.",
      );
    }

    const uploadedKey = await saveMeterPhoto(meter.id, input.photo);
    const data = {
      billingMonth,
      readingDate,
      readingValue,
      source: input.source,
      photoStorageKey: uploadedKey ?? existing?.photoStorageKey ?? null,
      notes: input.notes || null,
      reason: input.source === "ESTIMATED" ? input.reason || null : null,
    };
    if (existing) {
      return tx.meterReading.update({ where: { id: existing.id }, data });
    }
    return tx.meterReading.create({
      data: { ...data, meterId: meter.id, readingType: "MONTHLY" },
    });
  });
}

export async function recordMissingBoundary(input: RecordMissingBoundaryInput) {
  return tenancyTransaction(async (tx) => {
    const tenancy = await tx.tenancy.findUnique({
      where: { id: input.tenancyId },
      select: { spaceId: true, moveInDate: true, moveOutDate: true },
    });
    if (!tenancy) throw new Error("The tenancy was not found.");
    const boundaryDate =
      input.boundaryType === "MOVE_IN"
        ? tenancy.moveInDate
        : tenancy.moveOutDate;
    if (!boundaryDate) throw new Error("This tenancy has no move-out date.");
    if (boundaryDate.getTime() > Date.now()) {
      throw new Error("This boundary is not due yet.");
    }
    const meter = await activeMeter(tx, tenancy.spaceId, boundaryDate);
    if (!meter)
      throw new Error("No physical meter was active on the boundary date.");
    const existing = await tx.meterReading.findFirst({
      where: {
        meterId: meter.id,
        readingDate: boundaryDate,
        readingType: input.boundaryType,
      },
      select: { id: true },
    });
    if (existing)
      throw new Error("This boundary reading has already been recorded.");
    const readingValue = new Prisma.Decimal(reading(input.readingValue));
    if (input.source === "ESTIMATED") {
      requiredText(input.reason || "", "Estimated readings require a reason.");
    }
    const [previous, next] = await Promise.all([
      tx.meterReading.findFirst({
        where: { meterId: meter.id, readingDate: { lte: boundaryDate } },
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: { readingValue: true },
      }),
      tx.meterReading.findFirst({
        where: { meterId: meter.id, readingDate: { gte: boundaryDate } },
        orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
        select: { readingValue: true },
      }),
    ]);
    assertReadingDoesNotDecrease(previous?.readingValue ?? null, readingValue);
    if (next && readingValue.greaterThan(next.readingValue)) {
      throw new Error(
        "The reading cannot be higher than the next reading on this meter.",
      );
    }
    const photoStorageKey = await saveMeterPhoto(meter.id, input.photo);
    return tx.meterReading.create({
      data: {
        meterId: meter.id,
        readingDate: boundaryDate,
        readingValue,
        readingType: input.boundaryType,
        source: input.source,
        photoStorageKey,
        notes: input.notes || null,
        reason: input.source === "ESTIMATED" ? input.reason || null : null,
      },
    });
  });
}

export async function replaceMeter(input: ReplaceMeterInput) {
  const replacementDate = date(input.replacementDate),
    initial = new Prisma.Decimal(reading(input.newMeterInitialReading));
  requiredText(input.reason, "A replacement reason is required.");
  if (
    input.oldMeterFinalReading &&
    input.oldMeterFinalReadingSource === "ESTIMATED"
  )
    requiredText(input.reason, "Estimated readings require a reason.");
  return tenancyTransaction(async (tx) => {
    const old = await activeMeter(tx, input.spaceId, replacementDate);
    if (!old)
      throw new Error("There is no active electricity meter to replace.");
    if (
      input.oldMeterFinalReading !== undefined &&
      input.oldMeterFinalReading !== null
    ) {
      const finalValue = new Prisma.Decimal(
        reading(input.oldMeterFinalReading),
      );
      if ((input.oldMeterFinalReadingSource || "MEASURED") === "MEASURED") {
        const previous = await tx.meterReading.findFirst({
          where: { meterId: old.id, readingDate: { lte: replacementDate } },
          orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
          select: { readingValue: true },
        });
        assertReadingDoesNotDecrease(
          previous?.readingValue ?? null,
          finalValue,
        );
      }
      const photoStorageKey = await saveMeterPhoto(old.id, input.oldMeterPhoto);
      await tx.meterReading.create({
        data: {
          meterId: old.id,
          readingDate: replacementDate,
          readingValue: finalValue,
          readingType: "METER_REMOVAL",
          source: input.oldMeterFinalReadingSource || "MEASURED",
          photoStorageKey,
          reason:
            input.oldMeterFinalReadingSource === "ESTIMATED"
              ? input.reason
              : null,
          notes: input.notes || null,
        },
      });
    }
    await tx.meter.update({
      where: { id: old.id },
      data: { removedAt: replacementDate, notes: input.notes || undefined },
    });
    const meter = await tx.meter.create({
      data: {
        spaceId: input.spaceId,
        type: "ELECTRICITY",
        meterNumber: input.newMeterNumber || null,
        installedAt: replacementDate,
        notes: input.notes || null,
      },
      select: { id: true },
    });
    const photoStorageKey = await saveMeterPhoto(meter.id, input.newMeterPhoto);
    await tx.meterReading.create({
      data: {
        meterId: meter.id,
        readingDate: replacementDate,
        readingValue: initial,
        readingType: "METER_INSTALL",
        source: "MEASURED",
        photoStorageKey,
        reason: input.reason,
        notes: input.notes || null,
      },
    });
    return meter;
  });
}

export async function recordTenancyBoundaryInTransaction(
  tx: Prisma.TransactionClient,
  spaceId: string,
  readingDate: string | Date,
  readingValue: string | number | null,
  type: "MOVE_IN" | "MOVE_OUT",
  photo?: File,
  notes?: string,
  source: "MEASURED" | "ESTIMATED" = "MEASURED",
  reason?: string,
) {
  if (readingValue === null) return;
  const boundaryDate = date(readingDate);
  if (source === "ESTIMATED") {
    requiredText(reason || "", "Estimated readings require a reason.");
  }
  const meter = await tx.meter.findFirst({
    where: {
      spaceId,
      type: "ELECTRICITY",
      installedAt: { lte: boundaryDate },
      OR: [{ removedAt: null }, { removedAt: { gt: boundaryDate } }],
    },
    select: { id: true },
  });
  if (!meter) return;
  const normalizedValue = new Prisma.Decimal(reading(readingValue));
  if (source === "MEASURED") {
    const previous = await tx.meterReading.findFirst({
      where: { meterId: meter.id, readingDate: { lte: boundaryDate } },
      orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
      select: { readingValue: true },
    });
    assertReadingDoesNotDecrease(
      previous?.readingValue ?? null,
      normalizedValue,
    );
  }
  const photoStorageKey = await saveMeterPhoto(meter.id, photo);
  await tx.meterReading.create({
    data: {
      meterId: meter.id,
      readingDate: boundaryDate,
      readingValue: normalizedValue,
      readingType: type,
      source,
      photoStorageKey,
      notes: notes || null,
      reason: source === "ESTIMATED" ? reason || null : null,
    },
  });
}

export async function recordTenancyBoundary(
  spaceId: string,
  readingDate: string | Date,
  readingValue: string | number | null,
  type: "MOVE_IN" | "MOVE_OUT",
  photo?: File,
  notes?: string,
  source: "MEASURED" | "ESTIMATED" = "MEASURED",
  reason?: string,
) {
  return tenancyTransaction((tx) =>
    recordTenancyBoundaryInTransaction(
      tx,
      spaceId,
      readingDate,
      readingValue,
      type,
      photo,
      notes,
      source,
      reason,
    ),
  );
}
