import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  refreshDraftInvoicesForMeter,
  refreshDraftInvoicesForProperty,
  refreshDraftInvoicesForSpace,
} from "@/modules/billing/server/draft-refresh";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";
import {
  assertReadingDoesNotDecrease,
  monthEndExclusive,
  monthStart,
} from "../domain/rules";
import { resolveMonthlyClosingCandidate } from "../domain/monthly-closing";
import { date, reading, requiredText } from "../domain/validation";
import type {
  InstallMeterInput,
  RecordReadingInput,
  ReplaceMeterInput,
  RecordMissingBoundaryInput,
  SaveMonthlyReadingInput,
} from "../domain/types";
import { saveMeterPhoto } from "./meter-media";


function todayBusinessDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

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
      "Generic meter readings must be manual; lifecycle readings are managed by their workflows.",
    );
  }
  const readingDate = date(input.readingDate),
    readingValue = new Prisma.Decimal(reading(input.readingValue));
  const selectedBillingMonth = input.billingMonth
    ? monthStart(date(input.billingMonth))
    : null;
  const today = todayBusinessDate();
  if (readingDate > today) {
    throw new Error("Meter readings cannot be recorded in the future.");
  }
  if (selectedBillingMonth && readingDate < selectedBillingMonth) {
    throw new Error(
      "The reading date cannot be before the selected billing month.",
    );
  }
  if (input.source === "ESTIMATED")
    requiredText(input.reason || "", "Estimated readings require a reason.");
  return tenancyTransaction(async (tx) => {
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

    if (selectedBillingMonth) {
      const billingMonth = selectedBillingMonth;
      const [previousClosing, currentClosing] = await Promise.all([
        tx.meterMonthlyClosing.findFirst({
          where: { meterId: meter.id, billingMonth: { lt: billingMonth } },
          orderBy: { billingMonth: "desc" },
          select: { reading: { select: { readingDate: true } } },
        }),
        tx.meterMonthlyClosing.findUnique({
          where: { meterId_billingMonth: { meterId: meter.id, billingMonth } },
          select: {
            reading: {
              select: {
                id: true,
                readingDate: true,
                invoiceEvidence: {
                  where: { invoice: { status: "FINALIZED" } },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        }),
      ]);
      if (currentClosing?.reading.invoiceEvidence.length) {
        throw new Error(
          "This meter closing is locked by finalized billing data.",
        );
      }
      const minimumDate = [
        meter.installedAt,
        previousClosing?.reading.readingDate,
        currentClosing?.reading.readingDate,
      ]
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime())[0];
      if (readingDate < minimumDate) {
        throw new Error(
          "The reading date cannot be earlier than the current or previous closing, or the meter installation date.",
        );
      }
    }

    const existingMonthlyReading = selectedBillingMonth
      ? await tx.meterReading.findUnique({
          where: {
            meterId_billingMonth: {
              meterId: meter.id,
              billingMonth: selectedBillingMonth,
            },
          },
          select: { id: true, readingType: true },
        })
      : null;
    if (existingMonthlyReading) {
      if (
        existingMonthlyReading.readingType !== "MANUAL" &&
        existingMonthlyReading.readingType !== "MONTHLY"
      ) {
        throw new Error(
          "The selected billing month already has a managed lifecycle reading.",
        );
      }
      await assertReadingCoreEditable(tx, existingMonthlyReading.id);
    }

    if (input.source === "MEASURED") {
      const [prior, next] = await Promise.all([
        tx.meterReading.findFirst({
          where: {
            meterId: meter.id,
            readingDate: { lte: readingDate },
            ...(existingMonthlyReading
              ? { id: { not: existingMonthlyReading.id } }
              : {}),
          },
          orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
          select: { readingValue: true },
        }),
        tx.meterReading.findFirst({
          where: {
            meterId: meter.id,
            readingDate: { gte: readingDate },
            ...(existingMonthlyReading
              ? { id: { not: existingMonthlyReading.id } }
              : {}),
          },
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
    if (existingMonthlyReading) {
      return tx.meterReading.update({
        where: { id: existingMonthlyReading.id },
        data: {
          readingDate,
          readingValue,
          source: input.source,
          notes: input.notes || null,
          reason: input.reason || null,
          ...(photoStorageKey
            ? {
                photoStorageKey,
                evidencePhotos: { create: { storageKey: photoStorageKey } },
              }
            : {}),
        },
      });
    }
    return tx.meterReading.create({
      data: {
        meterId: meter.id,
        billingMonth: selectedBillingMonth,
        readingDate,
        readingValue,
        readingType: input.readingType,
        source: input.source,
        photoStorageKey,
        notes: input.notes || null,
        reason: input.reason || null,
        ...(photoStorageKey
          ? { evidencePhotos: { create: { storageKey: photoStorageKey } } }
          : {}),
      },
    });
  });
}

async function assertReadingCoreEditable(
  tx: Prisma.TransactionClient,
  readingId: string,
) {
  const dependency = await tx.invoiceMeterEvidence.findFirst({
    where: { readingId, invoice: { status: "FINALIZED" } },
    select: { invoice: { select: { type: true } } },
  });
  if (dependency) {
    throw new Error(
      dependency.invoice.type === "FINAL_SETTLEMENT"
        ? "This reading is locked by a finalized settlement."
        : "This reading is locked by a finalized invoice.",
    );
  }
}

async function monthlyClosingCandidate(
  tx: Prisma.TransactionClient,
  meterId: string,
  billingMonth: Date,
) {
  const meter = await tx.meter.findUnique({
    where: { id: meterId },
    select: {
      installedAt: true,
      removedAt: true,
      readings: {
        select: {
          id: true,
          readingDate: true,
          billingMonth: true,
          readingType: true,
          monthlyClosings: { select: { billingMonth: true } },
          invoiceEvidence: {
            where: { invoice: { status: "FINALIZED" } },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  if (!meter) return null;
  return resolveMonthlyClosingCandidate({
    billingMonth,
    meterInstalledAt: meter.installedAt,
    meterRemovedAt: meter.removedAt,
    readings: meter.readings.map((reading) => ({
      id: reading.id,
      readingDate: reading.readingDate,
      billingMonth: reading.billingMonth,
      readingType: reading.readingType,
      closingMonths: reading.monthlyClosings.map(
        (closing) => closing.billingMonth,
      ),
      locked: reading.invoiceEvidence.length > 0,
    })),
    closings: meter.readings.flatMap((reading) =>
      reading.monthlyClosings.map((closing) => ({
        billingMonth: closing.billingMonth,
        readingId: reading.id,
        readingDate: reading.readingDate,
      })),
    ),
  });
}

async function assertMonthlyClosingAssignment(
  tx: Prisma.TransactionClient,
  meterId: string,
  readingId: string,
  billingMonth: Date,
) {
  const selected = await tx.meterReading.findFirst({
    where: {
      id: readingId,
      meterId,
      readingType: { in: ["MANUAL", "MONTHLY"] },
    },
    select: {
      id: true,
      readingDate: true,
      billingMonth: true,
      meter: { select: { installedAt: true, removedAt: true } },
    },
  });
  if (!selected) {
    throw new Error("Choose an eligible manual reading for the monthly closing.");
  }
  const billingEnd = monthEndExclusive(billingMonth);
  if (
    selected.meter.installedAt >= billingEnd ||
    (selected.meter.removedAt && selected.meter.removedAt < billingEnd)
  ) {
    throw new Error(
      "Use the meter that covers month-end for the monthly closing; meter lifecycle boundaries remain separate.",
    );
  }
  if (selected.readingDate < billingMonth) {
    throw new Error("A monthly closing reading cannot be before its billing month.");
  }
  if (
    selected.billingMonth &&
    monthStart(selected.billingMonth).getTime() !== billingMonth.getTime()
  ) {
    throw new Error("This reading belongs to a different billing month.");
  }

  const [otherMonth, previous, next] = await Promise.all([
    tx.meterMonthlyClosing.findFirst({
      where: { readingId, billingMonth: { not: billingMonth } },
      select: { billingMonth: true },
    }),
    tx.meterMonthlyClosing.findFirst({
      where: { meterId, billingMonth: { lt: billingMonth } },
      orderBy: { billingMonth: "desc" },
      select: { reading: { select: { readingDate: true } } },
    }),
    tx.meterMonthlyClosing.findFirst({
      where: { meterId, billingMonth: { gt: billingMonth } },
      orderBy: { billingMonth: "asc" },
      select: { reading: { select: { readingDate: true } } },
    }),
  ]);
  if (otherMonth) {
    throw new Error("This reading is already assigned as another month's closing.");
  }
  if (previous && selected.readingDate < previous.reading.readingDate) {
    throw new Error("The closing reading is earlier than the previous monthly closing.");
  }
  if (next && selected.readingDate > next.reading.readingDate) {
    throw new Error("The closing reading is later than the next monthly closing.");
  }
  return selected;
}

export async function markReadingAsMonthlyClosing(input: {
  meterId: string;
  readingId: string;
  billingMonth: string;
}) {
  const billingMonth = monthStart(date(input.billingMonth));
  const result = await tenancyTransaction(async (tx) => {
    const reading = await assertMonthlyClosingAssignment(
      tx,
      input.meterId,
      input.readingId,
      billingMonth,
    );
    await assertReadingCoreEditable(tx, reading.id);
    const existingClosing = await tx.meterMonthlyClosing.findUnique({
      where: { meterId_billingMonth: { meterId: input.meterId, billingMonth } },
      select: { readingId: true },
    });
    if (existingClosing && existingClosing.readingId !== reading.id) {
      await assertReadingCoreEditable(tx, existingClosing.readingId);
    }
    return tx.meterMonthlyClosing.upsert({
      where: { meterId_billingMonth: { meterId: input.meterId, billingMonth } },
      create: { meterId: input.meterId, readingId: reading.id, billingMonth },
      update: { readingId: reading.id },
    });
  });
  await refreshDraftInvoicesForMeter(input.meterId);
  return result;
}

export async function markAllEligibleMonthlyClosings(input: {
  propertyId: string;
  billingMonth: string;
  assignments: Array<{ meterId: string; readingId: string }>;
}) {
  const billingMonth = monthStart(date(input.billingMonth));
  const billingEnd = monthEndExclusive(billingMonth);
  const uniqueAssignments = [
    ...new Map(
      input.assignments.map((assignment) => [assignment.meterId, assignment]),
    ).values(),
  ];
  const result = await tenancyTransaction(async (tx) => {
    if (!uniqueAssignments.length) return { assigned: 0, skipped: 0 };

    const meters = await tx.meter.findMany({
      where: {
        id: { in: uniqueAssignments.map((assignment) => assignment.meterId) },
        type: "ELECTRICITY",
        space: { type: "ROOM", floor: { propertyId: input.propertyId } },
        installedAt: { lt: billingEnd },
        OR: [{ removedAt: null }, { removedAt: { gte: billingEnd } }],
      },
      select: { id: true },
    });
    const allowedMeters = new Set(meters.map((meter) => meter.id));

    let assigned = 0;
    let skipped = 0;
    for (const assignment of uniqueAssignments) {
      if (!allowedMeters.has(assignment.meterId)) {
        skipped += 1;
        continue;
      }

      const existingClosing = await tx.meterMonthlyClosing.findUnique({
        where: {
          meterId_billingMonth: {
            meterId: assignment.meterId,
            billingMonth,
          },
        },
        select: {
          readingId: true,
          reading: {
            select: {
              readingDate: true,
              invoiceEvidence: {
                where: { invoice: { status: "FINALIZED" } },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      });
      if (existingClosing?.reading.invoiceEvidence.length) {
        skipped += 1;
        continue;
      }

      const candidate = await monthlyClosingCandidate(
        tx,
        assignment.meterId,
        billingMonth,
      );
      if (
        !candidate ||
        candidate.id !== assignment.readingId ||
        (existingClosing &&
          candidate.readingDate <= existingClosing.reading.readingDate)
      ) {
        skipped += 1;
        continue;
      }

      await assertMonthlyClosingAssignment(
        tx,
        assignment.meterId,
        assignment.readingId,
        billingMonth,
      );
      await assertReadingCoreEditable(tx, assignment.readingId);
      if (
        existingClosing &&
        existingClosing.readingId !== assignment.readingId
      ) {
        await assertReadingCoreEditable(tx, existingClosing.readingId);
      }
      await tx.meterMonthlyClosing.upsert({
        where: {
          meterId_billingMonth: {
            meterId: assignment.meterId,
            billingMonth,
          },
        },
        create: {
          meterId: assignment.meterId,
          readingId: assignment.readingId,
          billingMonth,
        },
        update: { readingId: assignment.readingId },
      });
      assigned += 1;
    }
    return { assigned, skipped };
  });
  await refreshDraftInvoicesForProperty(input.propertyId);
  return result;
}

export async function updateMeterReading(input: {
  readingId: string;
  readingDate: string;
  readingValue: string;
  source: "MEASURED" | "ESTIMATED";
  reason?: string;
  photo?: File;
}) {
  const readingDate = date(input.readingDate);
  const today = todayBusinessDate();
  if (readingDate > today) {
    throw new Error("Meter readings cannot be moved into the future.");
  }
  const readingValue = new Prisma.Decimal(reading(input.readingValue));
  if (input.source === "ESTIMATED") {
    requiredText(input.reason || "", "Estimated readings require a reason.");
  }
  const result = await tenancyTransaction(async (tx) => {
    const existing = await tx.meterReading.findUnique({
      where: { id: input.readingId },
      select: {
        id: true,
        meterId: true,
        readingType: true,
        monthlyClosings: { select: { billingMonth: true } },
        meter: { select: { installedAt: true, removedAt: true } },
      },
    });
    if (!existing) throw new Error("The reading was not found.");
    if (
      existing.readingType !== "MANUAL" &&
      existing.readingType !== "MONTHLY"
    ) {
      throw new Error(
        "Lifecycle readings are managed by their owning workflow.",
      );
    }
    await assertReadingCoreEditable(tx, existing.id);
    if (
      readingDate < existing.meter.installedAt ||
      (existing.meter.removedAt && readingDate > existing.meter.removedAt)
    ) {
      throw new Error(
        "The reading date is outside this meter's active period.",
      );
    }
    const neighbors = await tx.meterReading.findMany({
      where: { meterId: existing.meterId, id: { not: existing.id } },
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
    const photoStorageKey = await saveMeterPhoto(existing.meterId, input.photo);
    const updated = await tx.meterReading.update({
      where: { id: existing.id },
      data: {
        readingDate,
        readingValue,
        source: input.source,
        reason: input.source === "ESTIMATED" ? input.reason || null : null,
        ...(photoStorageKey
          ? { evidencePhotos: { create: { storageKey: photoStorageKey } } }
          : {}),
      },
    });
    for (const closing of existing.monthlyClosings) {
      await assertMonthlyClosingAssignment(
        tx,
        existing.meterId,
        existing.id,
        closing.billingMonth,
      );
    }
    return updated;
  });
  await refreshDraftInvoicesForMeter(result.meterId);
  return result;
}

export async function appendMeterReadingPhoto(readingId: string, photo?: File) {
  if (!photo) throw new Error("Choose a photo to upload.");
  const existing = await prisma.meterReading.findUnique({
    where: { id: readingId },
    select: { meterId: true },
  });
  if (!existing) throw new Error("The reading was not found.");
  const storageKey = await saveMeterPhoto(existing.meterId, photo);
  if (!storageKey) throw new Error("Choose a photo to upload.");
  return prisma.meterReadingPhoto.create({ data: { readingId, storageKey } });
}

export async function saveMonthlyReading(input: SaveMonthlyReadingInput) {
  const billingMonth = monthStart(date(input.billingMonth));
  const readingDate = date(input.readingDate);
  const readingValue = new Prisma.Decimal(reading(input.readingValue));
  if (readingDate < billingMonth) {
    throw new Error("The reading date cannot be before the selected billing month.");
  }
  if (input.source === "ESTIMATED") {
    requiredText(input.reason || "", "Estimated readings require a reason.");
  }

  const result = await tenancyTransaction(async (tx) => {
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
      throw new Error("The reading date is outside this meter's active period.");
    }

    const existingClosing = await tx.meterMonthlyClosing.findUnique({
      where: { meterId_billingMonth: { meterId: meter.id, billingMonth } },
      select: { readingId: true },
    });
    if (existingClosing) {
      await assertReadingCoreEditable(tx, existingClosing.readingId);
    }

    const neighbors = await tx.meterReading.findMany({
      where: { meterId: meter.id },
      orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
      select: { readingDate: true, readingValue: true },
    });
    const previous = neighbors
      .filter((item) => item.readingDate <= readingDate)
      .at(-1);
    const next = neighbors.find((item) => item.readingDate >= readingDate);
    assertReadingDoesNotDecrease(previous?.readingValue ?? null, readingValue);
    if (next && readingValue.greaterThan(next.readingValue)) {
      throw new Error("The reading cannot be higher than the next reading on this meter.");
    }

    const photoStorageKey = await saveMeterPhoto(meter.id, input.photo);
    const created = await tx.meterReading.create({
      data: {
        meterId: meter.id,
        billingMonth,
        readingDate,
        readingValue,
        readingType: "MANUAL",
        source: input.source,
        photoStorageKey,
        notes: input.notes || null,
        reason: input.source === "ESTIMATED" ? input.reason || null : null,
        ...(photoStorageKey
          ? { evidencePhotos: { create: { storageKey: photoStorageKey } } }
          : {}),
      },
      select: { id: true },
    });
    await assertMonthlyClosingAssignment(
      tx,
      meter.id,
      created.id,
      billingMonth,
    );
    await tx.meterMonthlyClosing.upsert({
      where: { meterId_billingMonth: { meterId: meter.id, billingMonth } },
      create: { meterId: meter.id, readingId: created.id, billingMonth },
      update: { readingId: created.id },
    });
    return created;
  });
  await refreshDraftInvoicesForMeter(input.meterId);
  return result;
}

export async function recordMissingBoundary(input: RecordMissingBoundaryInput) {
  const result = await tenancyTransaction(async (tx) => {
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
  await refreshDraftInvoicesForMeter(result.meterId);
  return result;
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
  const result = await tenancyTransaction(async (tx) => {
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
  await refreshDraftInvoicesForSpace(input.spaceId);
  return result;
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
  const result = await tenancyTransaction((tx) =>
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
  await refreshDraftInvoicesForSpace(spaceId);
  return result;
}
