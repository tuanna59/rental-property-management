import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { monthStart } from "../domain/rules";
import { date, reading, requiredText } from "../domain/validation";
import type { AddRateInput, ElectricityOverrideInput } from "../domain/types";

export async function addRate(input: AddRateInput) {
  const effectiveFrom = date(input.effectiveFrom),
    rate = new Prisma.Decimal(reading(input.rate));
  return prisma.$transaction(async (tx) => {
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
}

export async function setElectricityOverride(input: ElectricityOverrideInput) {
  requiredText(input.reason, "An override reason is required.");
  const billingMonth = monthStart(date(input.billingMonth));
  return prisma.electricityRateOverride.upsert({
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
}
