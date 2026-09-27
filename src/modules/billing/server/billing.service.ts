import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { nonNegativeWholeVnd } from "@/lib/money";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";
import { getBillingCandidates } from "./billing.queries";

export async function generateInvoice(
  propertyId: string,
  tenancyId: string,
  billingPeriod: string,
) {
  const candidate = (
    await getBillingCandidates(propertyId, billingPeriod)
  ).find((item) => item.tenancyId === tenancyId);
  if (!candidate || candidate.status !== "READY")
    throw new Error("This billing candidate is not ready.");
  return tenancyTransaction(async (tx) =>
    tx.invoice.create({
      data: {
        tenancyId,
        billingPeriod: candidate.billingPeriod,
        serviceStart: candidate.serviceStart,
        serviceEnd: candidate.serviceEnd,
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
    await generateInvoice(propertyId, candidate.tenancyId, billingPeriod);
  return candidates.length;
}

export async function updateDraftLine(
  invoiceId: string,
  lineId: string,
  finalAmount: string,
  overrideReason: string,
) {
  const amount = nonNegativeWholeVnd(finalAmount);
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
