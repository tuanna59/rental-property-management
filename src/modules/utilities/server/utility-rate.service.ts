import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  refreshDraftInvoicesForProperty,
  refreshDraftInvoicesForSpace,
} from "@/modules/billing/server/draft-refresh";
import { monthStart } from "../domain/rules";
import { date, month, reading, requiredText } from "../domain/validation";
import type { AddRateInput, ElectricityOverrideInput } from "../domain/types";

export async function addRate(input: AddRateInput) {
  const effectiveFrom = date(input.effectiveFrom),
    rate = new Prisma.Decimal(reading(input.rate));
  const result = await prisma.$transaction(async (tx) => {
    const later = await tx.utilityRate.findFirst({
      where: {
        propertyId: input.propertyId,
        utilityType: input.utilityType,
        effectiveFrom: { gt: effectiveFrom },
      },
      orderBy: { effectiveFrom: "asc" },
      select: { effectiveFrom: true },
    });
    const current = await tx.utilityRate.findFirst({
      where: {
        propertyId: input.propertyId,
        utilityType: input.utilityType,
        effectiveFrom: { lte: effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: { id: true },
    });
    if (current)
      await tx.utilityRate.update({
        where: { id: current.id },
        data: { effectiveTo: effectiveFrom },
      });
    return tx.utilityRate.create({
      data: {
        propertyId: input.propertyId,
        utilityType: input.utilityType,
        rate,
        effectiveFrom,
        effectiveTo: later?.effectiveFrom ?? null,
        notes: input.notes || null,
      },
    });
  });
  await refreshDraftInvoicesForProperty(input.propertyId);
  return result;
}

export async function setElectricityOverride(input: ElectricityOverrideInput) {
  requiredText(input.reason, "An override reason is required.");
  const billingMonth = monthStart(month(input.billingMonth));
  const result = await prisma.electricityRateOverride.upsert({
    where: { spaceId_billingMonth: { spaceId: input.spaceId, billingMonth } },
    create: {
      spaceId: input.spaceId,
      billingMonth,
      rate: new Prisma.Decimal(reading(input.rate)),
      reason: input.reason.trim(),
    },
    update: {
      rate: new Prisma.Decimal(reading(input.rate)),
      reason: input.reason.trim(),
    },
  });
  await refreshDraftInvoicesForSpace(input.spaceId);
  return result;
}
