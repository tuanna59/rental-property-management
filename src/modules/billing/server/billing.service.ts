import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  nonNegativeWholeVnd,
  positiveWholeVnd,
  roundMoneyAmount,
} from "@/lib/money";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";
import { getBillingCandidates } from "./billing.queries";

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
  reason: string;
};

function adjustmentData(input: AdjustmentInput) {
  if (!input.description.trim()) throw new Error("A description is required.");
  if (!input.reason.trim()) throw new Error("A reason is required.");
  return {
    type: input.type,
    description: input.description.trim(),
    amount: roundMoneyAmount(positiveWholeVnd(input.amount)),
    reason: input.reason.trim(),
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
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    if (!invoice || invoice.status !== "DRAFT")
      throw new Error("Only draft invoices can be finalized.");
    return tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    });
  });
}
