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
import { BillingDomainError } from "../domain/errors";
import { calculateInvoiceFinancials } from "../domain/invoice-financials";

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
  return tenancyTransaction(async (tx) => {
    const active = await tx.invoice.findFirst({
      where: {
        tenancyId,
        billingPeriod: candidate.billingPeriod,
        type: candidate.invoiceType,
        status: { not: "VOIDED" },
      },
      select: { id: true },
    });
    if (active) {
      throw new BillingDomainError(
        "ACTIVE_INVOICE_EXISTS",
        "An active invoice already exists for this billing period.",
      );
    }
    return tx.invoice.create({
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
    });
  });
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
    const line = await tx.invoiceLine.findFirst({
      where: { id: lineId, invoiceId },
      select: { id: true, type: true },
    });
    if (!line) throw new Error("Invoice line was not found.");
    if (line.type === "ADJUSTMENT") {
      throw new Error(
        "Manual adjustment lines must be changed through the draft adjustment action.",
      );
    }
    return tx.invoiceLine.update({
      where: { id: line.id },
      data: {
        finalAmount: amount,
        isOverridden: true,
        overrideReason: overrideReason.trim(),
      },
    });
  });
}

type DraftAdjustmentInput = {
  direction: "DECREASE" | "INCREASE";
  amount: string;
  reason: string;
};

function draftAdjustmentValues(input: DraftAdjustmentInput) {
  if (input.direction !== "DECREASE" && input.direction !== "INCREASE") {
    throw new BillingDomainError(
      "DRAFT_ADJUSTMENT_ONLY",
      "Draft adjustment direction must be DECREASE or INCREASE.",
    );
  }
  const amount = positiveWholeVnd(input.amount);
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) {
    throw new BillingDomainError(
      "ADJUSTMENT_REASON_REQUIRED",
      "A reason of 500 characters or fewer is required for an invoice adjustment.",
    );
  }
  const signedAmount =
    input.direction === "DECREASE" ? amount.negated() : amount;
  return { signedAmount, reason };
}

async function requireDraftInvoice(
  tx: Prisma.TransactionClient,
  invoiceId: string,
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  });
  if (!invoice || invoice.status !== "DRAFT") {
    throw new BillingDomainError(
      "DRAFT_ADJUSTMENT_ONLY",
      "Draft invoice adjustments can only be changed while the invoice is DRAFT.",
    );
  }
}

export async function addDraftInvoiceAdjustment(
  invoiceId: string,
  input: DraftAdjustmentInput,
) {
  const { signedAmount, reason } = draftAdjustmentValues(input);
  return tenancyTransaction(async (tx) => {
    await requireDraftInvoice(tx, invoiceId);
    const existing = await tx.invoiceLine.findFirst({
      where: { invoiceId, type: "ADJUSTMENT" },
      select: { id: true },
    });
    if (existing) {
      throw new BillingDomainError(
        "DRAFT_ADJUSTMENT_EXISTS",
        "This draft already has a manual adjustment.",
      );
    }
    return tx.invoiceLine.create({
      data: {
        invoiceId,
        type: "ADJUSTMENT",
        description: reason,
        sourceBillingMonth: null,
        servicePeriodStart: null,
        servicePeriodEnd: null,
        calculatedAmount: signedAmount,
        finalAmount: signedAmount,
        isOverridden: false,
        overrideReason: null,
        metadata: {
          origin: "DRAFT_MANUAL_ADJUSTMENT",
          direction: input.direction,
        },
      },
    });
  });
}

export async function updateDraftInvoiceAdjustment(
  invoiceId: string,
  lineId: string,
  input: DraftAdjustmentInput,
) {
  const { signedAmount, reason } = draftAdjustmentValues(input);
  return tenancyTransaction(async (tx) => {
    await requireDraftInvoice(tx, invoiceId);
    const line = await tx.invoiceLine.findFirst({
      where: { id: lineId, invoiceId, type: "ADJUSTMENT" },
      select: { id: true },
    });
    if (!line) {
      throw new BillingDomainError(
        "DRAFT_ADJUSTMENT_NOT_FOUND",
        "Draft invoice adjustment was not found.",
      );
    }
    return tx.invoiceLine.update({
      where: { id: line.id },
      data: {
        description: reason,
        calculatedAmount: signedAmount,
        finalAmount: signedAmount,
        metadata: {
          origin: "DRAFT_MANUAL_ADJUSTMENT",
          direction: input.direction,
        },
      },
    });
  });
}

export async function removeDraftInvoiceAdjustment(
  invoiceId: string,
  lineId: string,
) {
  return tenancyTransaction(async (tx) => {
    await requireDraftInvoice(tx, invoiceId);
    const line = await tx.invoiceLine.findFirst({
      where: { id: lineId, invoiceId, type: "ADJUSTMENT" },
      select: { id: true },
    });
    if (!line) {
      throw new BillingDomainError(
        "DRAFT_ADJUSTMENT_NOT_FOUND",
        "Draft invoice adjustment was not found.",
      );
    }
    return tx.invoiceLine.delete({ where: { id: line.id } });
  });
}

type FinalizedAdjustmentInput = {
  type: "CREDIT" | "DEBIT";
  amount: string;
  reason: string;
};

function requiredAdjustmentReason(reason: string) {
  const value = reason.trim();
  if (!value) {
    throw new BillingDomainError(
      "ADJUSTMENT_REASON_REQUIRED",
      "A reason is required for an invoice adjustment.",
    );
  }
  if (value.length > 500) {
    throw new BillingDomainError(
      "ADJUSTMENT_REASON_REQUIRED",
      "Adjustment reason must be 500 characters or fewer.",
    );
  }
  return value;
}

export async function addFinalizedInvoiceAdjustment(
  invoiceId: string,
  input: FinalizedAdjustmentInput,
) {
  if (input.type !== "CREDIT" && input.type !== "DEBIT") {
    throw new BillingDomainError(
      "ADJUSTMENT_FINALIZED_ONLY",
      "Adjustment type must be CREDIT or DEBIT.",
    );
  }
  const amount = positiveWholeVnd(input.amount);
  const reason = requiredAdjustmentReason(input.reason);
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { select: { finalAmount: true } },
        adjustments: { select: { type: true, amount: true } },
        payments: { select: { amount: true } },
      },
    });
    if (!invoice || invoice.status !== "FINALIZED") {
      throw new BillingDomainError(
        "ADJUSTMENT_FINALIZED_ONLY",
        "Only finalized invoices can receive post-finalization adjustments.",
      );
    }

    const current = calculateInvoiceFinancials({
      lineAmounts: invoice.lines.map((line) => line.finalAmount),
      adjustments: invoice.adjustments,
      payments: invoice.payments,
    });
    if (input.type === "CREDIT") {
      const nextEffectiveTotal =
        BigInt(current.effectiveTotal) - BigInt(amount.toString());
      if (nextEffectiveTotal < BigInt(current.paidAmount)) {
        throw new BillingDomainError(
          "ADJUSTMENT_OVERPAYMENT",
          "This adjustment would create an overpayment. Refund or tenant credit handling is not available yet.",
        );
      }
    }

    return tx.invoiceAdjustment.create({
      data: {
        invoiceId,
        type: input.type,
        amount,
        description:
          input.type === "CREDIT" ? "Credit adjustment" : "Debit adjustment",
        reason,
      },
    });
  });
}

export async function finalizeInvoice(invoiceId: string) {
  await refreshDraftInvoice(invoiceId);
  const draft = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      status: true,
      tenancyId: true,
      billingPeriod: true,
      type: true,
      tenancy: {
        select: { space: { select: { floor: { select: { propertyId: true } } } } },
      },
    },
  });
  if (!draft || draft.status !== "DRAFT")
    throw new Error("Only draft invoices can be finalized.");
  const candidate = (
    await getBillingCandidates(
      draft.tenancy.space.floor.propertyId,
      draft.billingPeriod,
    )
  ).find(
    (item) =>
      item.tenancyId === draft.tenancyId && item.invoiceType === draft.type,
  );
  if (!candidate || candidate.readiness !== "READY") {
    throw new Error(
      "This invoice cannot be finalized until its current billing source data is ready.",
    );
  }
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

function paidAmount(payments: Array<{ amount: Prisma.Decimal }>) {
  return payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );
}

function requiredVoidReason(reason: string) {
  const value = reason.trim();
  if (!value) {
    throw new BillingDomainError(
      "VOID_REASON_REQUIRED",
      "A reason is required to void an invoice.",
    );
  }
  return value;
}

function assertVoidEligible(invoice: {
  status: "DRAFT" | "FINALIZED" | "VOIDED";
  payments: Array<{ amount: Prisma.Decimal }>;
  adjustments: Array<{ id?: string }>;
}) {
  if (invoice.status === "VOIDED") {
    throw new BillingDomainError(
      "INVOICE_ALREADY_VOIDED",
      "This invoice has already been voided.",
    );
  }
  if (invoice.status !== "FINALIZED") {
    throw new BillingDomainError(
      "INVOICE_NOT_FINALIZED",
      "Only finalized invoices can be voided or corrected.",
    );
  }
  if (paidAmount(invoice.payments).greaterThan(0)) {
    throw new BillingDomainError(
      "INVOICE_HAS_PAYMENTS",
      "This invoice already has payments and cannot be voided. Use an adjustment instead.",
    );
  }
  if (invoice.adjustments.length > 0) {
    throw new BillingDomainError(
      "INVOICE_HAS_ADJUSTMENTS",
      "This invoice already has adjustments and cannot be voided or replaced.",
    );
  }
}

export async function voidInvoice(invoiceId: string, reason: string) {
  const voidReason = requiredVoidReason(reason);
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        payments: { select: { amount: true } },
        adjustments: { select: { id: true } },
      },
    });
    if (!invoice) {
      throw new BillingDomainError(
        "INVOICE_NOT_FINALIZED",
        "Invoice was not found.",
      );
    }
    assertVoidEligible(invoice);
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidReason,
      },
    });
  });
}

export async function correctInvoice(invoiceId: string, reason: string) {
  const voidReason = requiredVoidReason(reason);
  return tenancyTransaction(async (tx) => {
    const original = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { type: "asc" } },
        adjustments: { orderBy: { createdAt: "asc" } },
        payments: { select: { amount: true } },
        replacementInvoices: { select: { id: true }, take: 1 },
      },
    });
    if (!original) {
      throw new BillingDomainError(
        "INVOICE_NOT_FINALIZED",
        "Invoice was not found.",
      );
    }
    assertVoidEligible(original);
    if (original.replacementInvoices.length) {
      throw new BillingDomainError(
        "CORRECTION_ALREADY_EXISTS",
        "A replacement invoice already exists for this invoice.",
      );
    }

    const activePeer = await tx.invoice.findFirst({
      where: {
        tenancyId: original.tenancyId,
        billingPeriod: original.billingPeriod,
        type: original.type,
        status: { not: "VOIDED" },
        id: { not: original.id },
      },
      select: { id: true },
    });
    if (activePeer) {
      throw new BillingDomainError(
        "ACTIVE_INVOICE_EXISTS",
        "Another active invoice already exists for this billing period.",
      );
    }

    const voidedAt = new Date();
    await tx.invoice.update({
      where: { id: original.id },
      data: { status: "VOIDED", voidedAt, voidReason },
    });

    return tx.invoice.create({
      data: {
        tenancyId: original.tenancyId,
        billingPeriod: original.billingPeriod,
        invoiceDate: original.invoiceDate,
        type: original.type,
        serviceStart: original.serviceStart,
        serviceEnd: original.serviceEnd,
        status: "DRAFT",
        propertyNameSnapshot: original.propertyNameSnapshot,
        roomNameSnapshot: original.roomNameSnapshot,
        renterNameSnapshot: original.renterNameSnapshot,
        replacesInvoiceId: original.id,
        lines: {
          create: original.lines.map((line) => ({
            type: line.type,
            description: line.description,
            sourceBillingMonth: line.sourceBillingMonth,
            servicePeriodStart: line.servicePeriodStart,
            servicePeriodEnd: line.servicePeriodEnd,
            calculatedAmount: line.calculatedAmount,
            finalAmount: line.finalAmount,
            isOverridden: line.isOverridden,
            overrideReason: line.overrideReason,
            metadata: line.metadata as Prisma.InputJsonValue,
          })),
        },
      },
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
