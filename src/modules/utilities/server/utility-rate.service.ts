import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  refreshDraftInvoicesForProperty,
  refreshDraftInvoicesForSpace,
} from "@/modules/billing/server/draft-refresh";
import { UtilityRateDomainError } from "../domain/rate-errors";
import { monthStart } from "../domain/rules";
import { date, month, reading } from "../domain/validation";
import type { AddRateInput, UtilityOverrideInput } from "../domain/types";

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

export async function setUtilityOverride(input: UtilityOverrideInput) {
  if (!input.reason.trim()) {
    throw new UtilityRateDomainError(
      "OVERRIDE_REASON_REQUIRED",
      "An override reason is required.",
    );
  }
  if (input.utilityType !== "ELECTRICITY" && input.utilityType !== "WATER") {
    throw new UtilityRateDomainError(
      "OVERRIDE_UTILITY_INVALID",
      "Utility type is invalid.",
    );
  }

  const effectiveFrom = monthStart(month(input.effectiveMonth));
  const requestedEffectiveTo = input.expireMonth
    ? monthStart(month(input.expireMonth))
    : null;

  if (
    requestedEffectiveTo &&
    requestedEffectiveTo.getTime() <= effectiveFrom.getTime()
  ) {
    throw new UtilityRateDomainError(
      "OVERRIDE_EXPIRE_INVALID",
      "Expire month must be after the effective month.",
    );
  }

  const rate = new Prisma.Decimal(reading(input.rate));
  const reason = input.reason.trim();

  const result = await prisma.$transaction(async (tx) => {
    const [next, current, existingAtStart] = await Promise.all([
      tx.utilityRateOverride.findFirst({
        where: {
          spaceId: input.spaceId,
          utilityType: input.utilityType,
          effectiveFrom: { gt: effectiveFrom },
        },
        orderBy: { effectiveFrom: "asc" },
        select: { effectiveFrom: true },
      }),
      tx.utilityRateOverride.findFirst({
        where: {
          spaceId: input.spaceId,
          utilityType: input.utilityType,
          effectiveFrom: { lt: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
        orderBy: { effectiveFrom: "desc" },
        select: { id: true, effectiveTo: true },
      }),
      tx.utilityRateOverride.findUnique({
        where: {
          spaceId_utilityType_effectiveFrom: {
            spaceId: input.spaceId,
            utilityType: input.utilityType,
            effectiveFrom,
          },
        },
        select: { id: true, effectiveTo: true },
      }),
    ]);

    if (
      requestedEffectiveTo &&
      next &&
      requestedEffectiveTo.getTime() > next.effectiveFrom.getTime()
    ) {
      throw new UtilityRateDomainError(
        "OVERRIDE_RANGE_OVERLAP",
        "The override range overlaps a later room rate.",
      );
    }

    // A blank expire month means this override remains active until the next
    // room-specific override starts. An explicit expire month may end earlier.
    const effectiveTo = requestedEffectiveTo ?? next?.effectiveFrom ?? null;

    // Saving a rate can affect more than the newly-created row: an earlier
    // open range is closed at effectiveFrom, and an existing row with the same
    // start month may be shortened/extended. Protect every month whose resolved
    // room rate could therefore change once an invoice has been finalized.
    const affectedEnds: Date[] = [];
    let affectedOpenEnded = false;
    for (const end of [
      effectiveTo,
      ...(current ? [current.effectiveTo] : []),
      ...(existingAtStart ? [existingAtStart.effectiveTo] : []),
    ]) {
      if (end === null) affectedOpenEnded = true;
      else affectedEnds.push(end);
    }
    const affectedTo = affectedOpenEnded
      ? null
      : affectedEnds.reduce<Date | null>(
          (latest, value) =>
            !latest || value.getTime() > latest.getTime() ? value : latest,
          null,
        );

    const finalizedInvoice = await tx.invoice.findFirst({
      where: {
        status: "FINALIZED",
        tenancy: { spaceId: input.spaceId },
        lines: {
          some: {
            type: input.utilityType,
            sourceBillingMonth: {
              gte: effectiveFrom,
              ...(affectedTo ? { lt: affectedTo } : {}),
            },
          },
        },
      },
      select: { id: true },
    });

    if (finalizedInvoice) {
      throw new UtilityRateDomainError(
        "OVERRIDE_FINALIZED_PERIOD",
        "This rate change affects a billing month that already has a finalized invoice.",
      );
    }

    if (current) {
      await tx.utilityRateOverride.update({
        where: { id: current.id },
        data: { effectiveTo: effectiveFrom },
      });
    }

    return tx.utilityRateOverride.upsert({
      where: {
        spaceId_utilityType_effectiveFrom: {
          spaceId: input.spaceId,
          utilityType: input.utilityType,
          effectiveFrom,
        },
      },
      create: {
        spaceId: input.spaceId,
        utilityType: input.utilityType,
        effectiveFrom,
        effectiveTo,
        rate,
        reason,
      },
      update: {
        effectiveTo,
        rate,
        reason,
      },
    });
  });

  await refreshDraftInvoicesForSpace(input.spaceId);
  return result;
}

