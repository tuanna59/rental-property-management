import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  nonNegativeWholeVnd,
  positiveWholeVnd,
  roundMoneyAmount,
} from "@/lib/money";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";
import { getBillingCandidates } from "./billing.queries";
import { refreshDraftInvoice } from "./draft-refresh";

export async function generateInvoice(
  propertyId: string,
  tenancyId: string,
  billingPeriod: string,
  invoiceType: "REGULAR" | "FINAL_SETTLEMENT",
) {
  const candidate = (
    await getBillingCandidates(propertyId, billingPeriod)
  ).find(
    (item) => item.tenancyId === tenancyId && item.invoiceType === invoiceType,
  );
  if (!candidate || candidate.status !== "READY")
    throw new Error("This billing candidate is not ready.");
  return tenancyTransaction(async (tx) =>
    tx.invoice.create({
      data: {
        tenancyId,
        billingPeriod: candidate.billingPeriod,
        invoiceDate: candidate.invoiceDate,
        type: candidate.invoiceType,
        serviceStart: null,
        serviceEnd: null,
        propertyNameSnapshot: candidate.propertyName,
        roomNameSnapshot: candidate.room,
        renterNameSnapshot: candidate.renterName,
        lines: {
          create: candidate.lines.map((line) => {
            if (line.calculatedAmount === null || line.finalAmount === null)
              throw new Error("Required billing data is missing.");
            return {
              type: line.type,
              description: line.description,
              sourceBillingMonth: line.sourceBillingMonth,
              servicePeriodStart: line.servicePeriodStart,
              servicePeriodEnd: line.servicePeriodEnd,
              calculatedAmount: new Prisma.Decimal(line.calculatedAmount),
              finalAmount: new Prisma.Decimal(line.finalAmount),
              metadata: line.metadata as Prisma.InputJsonValue,
            };
          }),
        },
      },
    }),
  );
}

export async function generateAllReady(
  propertyId: string,
  billingPeriod: string,
) {
  const candidates = (
    await getBillingCandidates(propertyId, billingPeriod)
  ).filter((item) => item.status === "READY");
  for (const candidate of candidates)
    await generateInvoice(
      propertyId,
      candidate.tenancyId,
      billingPeriod,
      candidate.invoiceType,
    );
  return candidates.length;
}

export async function updateDraftLine(
  invoiceId: string,
  lineId: string,
  finalAmount: string,
  overrideReason: string,
) {
  const amount = roundMoneyAmount(nonNegativeWholeVnd(finalAmount));
  if (!overrideReason.trim())
    throw new Error("An override reason is required.");
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    if (!invoice || invoice.status !== "DRAFT")
      throw new Error("Only draft invoices can be changed.");
    return tx.invoiceLine.update({
      where: { id: lineId, invoiceId },
      data: {
        finalAmount: amount,
        isOverridden: true,
        overrideReason: overrideReason.trim(),
      },
    });
  });
}

type AdjustmentInput = {
  type: "CHARGE" | "CREDIT";
  description: string;
  amount: string;
  reason?: string;
};

function adjustmentData(input: AdjustmentInput) {
  if (!input.description.trim()) throw new Error("A description is required.");
  return {
    type: input.type,
    description: input.description.trim(),
    amount: roundMoneyAmount(positiveWholeVnd(input.amount)),
    // Prisma currently stores adjustment reason as a required string.
    // Keep an empty string for an omitted optional reason and hide it in presentation.
    reason: input.reason?.trim() ?? "",
  };
}

export async function addInvoiceAdjustment(
  invoiceId: string,
  input: AdjustmentInput,
) {
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    if (!invoice || invoice.status !== "DRAFT")
      throw new Error("Only draft invoices can be changed.");
    return tx.invoiceAdjustment.create({
      data: { invoiceId, ...adjustmentData(input) },
    });
  });
}

export async function updateInvoiceAdjustment(
  invoiceId: string,
  adjustmentId: string,
  input: AdjustmentInput,
) {
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    if (!invoice || invoice.status !== "DRAFT")
      throw new Error("Only draft invoices can be changed.");
    return tx.invoiceAdjustment.update({
      where: { id: adjustmentId, invoiceId },
      data: adjustmentData(input),
    });
  });
}

export async function deleteInvoiceAdjustment(
  invoiceId: string,
  adjustmentId: string,
) {
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    if (!invoice || invoice.status !== "DRAFT")
      throw new Error("Only draft invoices can be changed.");
    return tx.invoiceAdjustment.delete({
      where: { id: adjustmentId, invoiceId },
    });
  });
}

export async function finalizeInvoice(invoiceId: string) {
  await refreshDraftInvoice(invoiceId);
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        status: true,
        lines: {
          where: { type: "ELECTRICITY" },
          select: { metadata: true },
        },
      },
    });
    if (!invoice || invoice.status !== "DRAFT")
      throw new Error("Only draft invoices can be finalized.");
    const readingIds = new Set<string>();
    const evidenceRoles = new Map<string, EvidenceRole>();
    for (const line of invoice.lines) {
      const metadata = line.metadata as Record<string, unknown>;
      const segments = Array.isArray(metadata.meterSegments)
        ? metadata.meterSegments
        : [];
      for (const segment of segments) {
        if (!segment || typeof segment !== "object") continue;
        const record = segment as Record<string, unknown>;
        const ids = record.sourceReadingIds;
        if (Array.isArray(ids))
          ids.forEach((id) => {
            if (typeof id === "string") readingIds.add(id);
          });
        const meterId = record.meterId;
        const opening = record.openingReading as Record<string, unknown> | null;
        const closing = record.closingReading as Record<string, unknown> | null;
        const monthlyClosing = record.monthlyClosingReading as
          | Record<string, unknown>
          | null;
        if (typeof opening?.readingId === "string") {
          readingIds.add(opening.readingId);
          evidenceRoles.set(opening.readingId, "OPENING_ANCHOR");
        }
        if (typeof closing?.readingId === "string") {
          readingIds.add(closing.readingId);
        }
        if (typeof monthlyClosing?.readingId === "string") {
          readingIds.add(monthlyClosing.readingId);
          evidenceRoles.set(monthlyClosing.readingId, "CLOSING");
        }
        if (
          typeof meterId === "string" &&
          typeof opening?.date === "string" &&
          typeof closing?.date === "string"
        ) {
          const evidence = await tx.meterReading.findMany({
            where: {
              meterId,
              readingDate: {
                gte: new Date(`${opening.date}T00:00:00.000Z`),
                lte: new Date(`${closing.date}T00:00:00.000Z`),
              },
            },
            select: { id: true },
          });
          evidence.forEach((reading) => readingIds.add(reading.id));
        }
      }
    }
    if (readingIds.size) {
      const readings = await tx.meterReading.findMany({
        where: { id: { in: [...readingIds] } },
        select: { id: true, readingType: true },
      });
      readings.forEach((reading) => {
        if (!evidenceRoles.has(reading.id)) {
          evidenceRoles.set(reading.id, evidenceRole(reading.readingType));
        }
      });
      await tx.invoiceMeterEvidence.createMany({
        data: [...readingIds].map((readingId) => ({
          invoiceId,
          readingId,
          role: evidenceRoles.get(readingId),
        })),
        skipDuplicates: true,
      });
    }
    return tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    });
  });
}

type EvidenceRole =
  | "OPENING_ANCHOR"
  | "CLOSING"
  | "MANUAL_EVIDENCE"
  | "MOVE_IN_BOUNDARY"
  | "MOVE_OUT_BOUNDARY"
  | "METER_INSTALL"
  | "METER_REMOVAL";

function evidenceRole(
  readingType:
    | "MONTHLY"
    | "MOVE_IN"
    | "MOVE_OUT"
    | "METER_INSTALL"
    | "METER_REMOVAL"
    | "MANUAL",
): EvidenceRole {
  if (readingType === "MOVE_IN") return "MOVE_IN_BOUNDARY";
  if (readingType === "MOVE_OUT") return "MOVE_OUT_BOUNDARY";
  if (readingType === "METER_INSTALL") return "METER_INSTALL";
  if (readingType === "METER_REMOVAL") return "METER_REMOVAL";
  return "MANUAL_EVIDENCE";
}
