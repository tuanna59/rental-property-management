import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingCandidates } from "./billing.queries";

type DraftScope =
  | { spaceId: string; propertyId?: never }
  | { propertyId: string; spaceId?: never };

const lineKey = (type: string, sourceBillingMonth: Date | null) =>
  `${type}:${sourceBillingMonth?.toISOString().slice(0, 10) ?? "none"}`;

async function refreshDraftInvoices(scope: DraftScope) {
  const drafts = await prisma.invoice.findMany({
    where: {
      status: "DRAFT",
      tenancy: {
        space: scope.spaceId
          ? { id: scope.spaceId }
          : { floor: { propertyId: scope.propertyId } },
      },
    },
    select: {
      id: true,
      tenancyId: true,
      billingPeriod: true,
      type: true,
      replacesInvoiceId: true,
      tenancy: {
        select: {
          space: {
            select: { floor: { select: { propertyId: true } } },
          },
        },
      },
      lines: {
        select: {
          type: true,
          sourceBillingMonth: true,
          finalAmount: true,
          isOverridden: true,
          overrideReason: true,
        },
      },
    },
  });

  const candidateCache = new Map<
    string,
    Awaited<ReturnType<typeof getBillingCandidates>>
  >();

  for (const draft of drafts) {
    const propertyId = draft.tenancy.space.floor.propertyId;
    const cacheKey = `${propertyId}:${draft.billingPeriod.toISOString().slice(0, 10)}`;
    let candidates = candidateCache.get(cacheKey);
    if (!candidates) {
      candidates = await getBillingCandidates(propertyId, draft.billingPeriod);
      candidateCache.set(cacheKey, candidates);
    }
    const candidate = candidates.find(
      (item) =>
        item.tenancyId === draft.tenancyId && item.invoiceType === draft.type,
    );

    if (!candidate || candidate.readiness !== "READY") {
      // Correction drafts start as a faithful copy of the voided invoice and
      // must survive while the operator fixes the unlocked source data.
      if (draft.replacesInvoiceId) continue;
      await prisma.$transaction([
        prisma.invoiceMeterEvidence.deleteMany({ where: { invoiceId: draft.id } }),
        prisma.invoiceAdjustment.deleteMany({ where: { invoiceId: draft.id } }),
        prisma.invoiceLine.deleteMany({ where: { invoiceId: draft.id } }),
        prisma.invoice.delete({ where: { id: draft.id } }),
      ]);
      continue;
    }

    const overrides = new Map(
      draft.lines
        .filter((line) => line.isOverridden)
        .map((line) => [lineKey(line.type, line.sourceBillingMonth), line]),
    );
    const freshLines = candidate.lines.map((line) => {
      if (line.calculatedAmount === null || line.finalAmount === null) {
        throw new Error("A refreshed draft is missing required billing data.");
      }
      const override = overrides.get(lineKey(line.type, line.sourceBillingMonth));
      return {
        invoiceId: draft.id,
        type: line.type,
        description: line.description,
        sourceBillingMonth: line.sourceBillingMonth,
        servicePeriodStart: line.servicePeriodStart,
        servicePeriodEnd: line.servicePeriodEnd,
        calculatedAmount: new Prisma.Decimal(line.calculatedAmount),
        finalAmount: override
          ? override.finalAmount
          : new Prisma.Decimal(line.finalAmount),
        isOverridden: Boolean(override),
        overrideReason: override?.overrideReason ?? null,
        metadata: line.metadata as Prisma.InputJsonValue,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: draft.id } });
      if (freshLines.length) {
        await tx.invoiceLine.createMany({ data: freshLines });
      }
      await tx.invoice.update({
        where: { id: draft.id },
        data: {
          invoiceDate: candidate.invoiceDate,
          propertyNameSnapshot: candidate.propertyName,
          roomNameSnapshot: candidate.room,
          renterNameSnapshot: candidate.renterName,
        },
      });
    });
  }
}

export async function refreshDraftInvoicesForSpace(spaceId: string) {
  await refreshDraftInvoices({ spaceId });
}

export async function refreshDraftInvoicesForProperty(propertyId: string) {
  await refreshDraftInvoices({ propertyId });
}

export async function refreshDraftInvoicesForMeter(meterId: string) {
  const meter = await prisma.meter.findUnique({
    where: { id: meterId },
    select: { spaceId: true },
  });
  if (meter) await refreshDraftInvoicesForSpace(meter.spaceId);
}

export async function refreshDraftInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { tenancy: { select: { spaceId: true } } },
  });
  if (invoice) await refreshDraftInvoicesForSpace(invoice.tenancy.spaceId);
}
