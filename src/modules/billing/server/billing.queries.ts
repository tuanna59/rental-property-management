import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { roundVnd } from "@/lib/money";
import { toDateOnly } from "@/lib/presentation";
import {
  monthEndExclusive,
  monthStart,
} from "@/modules/utilities/domain/rules";
import { date } from "@/modules/utilities/domain/validation";
import {
  getElectricityPreview,
  getWaterPreview,
} from "@/modules/utilities/server/utility.queries";
import { resolveRegularBillingPeriods } from "../domain/billing-policy";

const money = (value: Prisma.Decimal) => value.toString();
const DAY = 86_400_000;

function billingIssue(reason: string | null) {
  const issue = reason?.toLowerCase() ?? "";
  if (issue.includes("move-out")) return "Missing move-out boundary";
  if (issue.includes("move-in")) return "Missing move-in boundary";
  if (issue.includes("monthly") || issue.includes("closing"))
    return "Missing monthly meter reading";
  if (issue.includes("rate")) return "Missing electricity rate";
  return "Incomplete electricity attribution";
}

export async function getBillingCandidates(
  propertyId: string,
  month: string | Date,
) {
  const periods = resolveRegularBillingPeriods(monthStart(date(month)));
  const billingPeriod = periods.invoiceMonth;
  const monthEnd = monthEndExclusive(billingPeriod);
  const utilityMonth = periods.utilityBillingMonth;
  const utilityEnd = monthEndExclusive(utilityMonth);
  const tenancies = await prisma.tenancy.findMany({
    where: {
      space: { floor: { propertyId } },
      moveInDate: { lt: monthEnd },
      OR: [{ moveOutDate: null }, { moveOutDate: { gt: billingPeriod } }],
    },
    orderBy: [
      { space: { floor: { sortOrder: "asc" } } },
      { space: { sortOrder: "asc" } },
      { moveInDate: "asc" },
    ],
    select: {
      id: true,
      moveInDate: true,
      moveOutDate: true,
      monthlyRentVnd: true,
      space: {
        select: {
          id: true,
          name: true,
          floor: { select: { property: { select: { name: true } } } },
        },
      },
      occupants: {
        where: { role: "RESPONSIBLE" },
        orderBy: { startDate: "asc" },
        take: 1,
        select: { person: { select: { fullName: true } } },
      },
      invoices: {
        where: { billingPeriod },
        select: { id: true, status: true, type: true },
      },
    },
  });
  const spaceIds = [...new Set(tenancies.map((item) => item.space.id))];
  const [
    regularWater,
    settlementWater,
    regularElectricity,
    settlementElectricity,
  ] = await Promise.all([
    getWaterPreview(propertyId, utilityMonth),
    getWaterPreview(propertyId, billingPeriod),
    Promise.all(
      spaceIds.map(
        async (spaceId) =>
          [
            spaceId,
            await getElectricityPreview(spaceId, utilityMonth),
          ] as const,
      ),
    ),
    Promise.all(
      spaceIds.map(
        async (spaceId) =>
          [
            spaceId,
            await getElectricityPreview(spaceId, billingPeriod),
          ] as const,
      ),
    ),
  ]);
  const regularElectricityBySpace = new Map(regularElectricity);
  const settlementElectricityBySpace = new Map(settlementElectricity);
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const candidates = [];

  for (const tenancy of tenancies) {
    const renterName = tenancy.occupants[0]?.person.fullName ?? "Tenant";
    const common = {
      tenancyId: tenancy.id,
      propertyName: tenancy.space.floor.property.name,
      room: tenancy.space.name,
      renterName,
      billingPeriod,
    };
    const rentStart =
      tenancy.moveInDate > billingPeriod ? tenancy.moveInDate : billingPeriod;
    const rentEnd =
      tenancy.moveOutDate && tenancy.moveOutDate < monthEnd
        ? tenancy.moveOutDate
        : monthEnd;
    const fullMonth =
      rentStart.getTime() === billingPeriod.getTime() &&
      rentEnd.getTime() === monthEnd.getTime();
    const billableDays = fullMonth
      ? 30
      : Math.max(
          0,
          Math.round((rentEnd.getTime() - rentStart.getTime()) / DAY),
        );
    const rentCalculated = fullMonth
      ? new Prisma.Decimal(tenancy.monthlyRentVnd.toString())
      : new Prisma.Decimal(tenancy.monthlyRentVnd.toString())
          .div(30)
          .mul(billableDays);
    const occupiedUtilityMonth =
      tenancy.moveInDate < utilityEnd &&
      (!tenancy.moveOutDate || tenancy.moveOutDate > utilityMonth);
    const regularMissing: string[] = [];
    const regularLines: Array<{
      type: "RENT" | "ELECTRICITY" | "WATER";
      description: string;
      sourceBillingMonth: Date;
      servicePeriodStart: Date;
      servicePeriodEnd: Date;
      calculatedAmount: string | null;
      finalAmount: string | null;
      metadata: Record<string, unknown>;
    }> = [
      {
        type: "RENT" as const,
        description: fullMonth
          ? "Monthly rent"
          : `Prorated rent · ${billableDays} days`,
        sourceBillingMonth: billingPeriod,
        servicePeriodStart: rentStart,
        servicePeriodEnd: rentEnd,
        calculatedAmount: money(rentCalculated),
        finalAmount: money(roundVnd(rentCalculated)),
        metadata: {
          monthlyRentVnd: tenancy.monthlyRentVnd.toString(),
          fullMonth,
          billableDays,
          serviceStart: toDateOnly(rentStart),
          serviceEnd: toDateOnly(rentEnd),
        },
      },
    ];
    if (occupiedUtilityMonth) {
      const electricity = regularElectricityBySpace.get(tenancy.space.id)!;
      regularLines.push(
        ...utilityLines(
          tenancy.id,
          utilityMonth,
          electricity,
          regularWater,
          false,
          regularMissing,
          undefined,
        ),
      );
    }
    const regularExisting =
      tenancy.invoices.find((item) => item.type === "REGULAR") ?? null;
    const regularReadiness =
      billingPeriod > today
        ? "UPCOMING"
        : regularMissing.length
          ? "MISSING_DATA"
          : "READY";
    candidates.push({
      ...common,
      candidateKey: `${tenancy.id}:REGULAR`,
      invoiceType: "REGULAR" as const,
      invoiceDate: billingPeriod,
      invoiceId: regularExisting?.id ?? null,
      status: regularExisting?.status ?? regularReadiness,
      readiness: regularReadiness,
      serviceStart: rentStart,
      serviceEnd: rentEnd,
      utilityBillingMonth: occupiedUtilityMonth ? utilityMonth : null,
      missing: regularMissing,
      lines: regularLines,
    });

    const moveOut = tenancy.moveOutDate;
    if (moveOut && moveOut >= billingPeriod && moveOut < monthEnd) {
      const settlementMissing: string[] = [];
      const electricity = settlementElectricityBySpace.get(tenancy.space.id)!;
      const settlementLines = utilityLines(
        tenancy.id,
        billingPeriod,
        electricity,
        settlementWater,
        true,
        settlementMissing,
        moveOut,
      );
      const settlementExisting =
        tenancy.invoices.find((item) => item.type === "FINAL_SETTLEMENT") ??
        null;
      const settlementReadiness =
        moveOut > today
          ? "UPCOMING"
          : settlementMissing.length
            ? "MISSING_DATA"
            : "READY";
      candidates.push({
        ...common,
        candidateKey: `${tenancy.id}:FINAL_SETTLEMENT`,
        invoiceType: "FINAL_SETTLEMENT" as const,
        invoiceDate: moveOut,
        invoiceId: settlementExisting?.id ?? null,
        status: settlementExisting?.status ?? settlementReadiness,
        readiness: settlementReadiness,
        serviceStart: billingPeriod,
        serviceEnd: moveOut,
        utilityBillingMonth: billingPeriod,
        missing: settlementMissing,
        lines: settlementLines,
      });
    }
  }
  return candidates;
}

type ElectricityPreview = Awaited<ReturnType<typeof getElectricityPreview>>;
type WaterPreview = Awaited<ReturnType<typeof getWaterPreview>>;

function utilityLines(
  tenancyId: string,
  sourceMonth: Date,
  electricity: ElectricityPreview,
  water: WaterPreview,
  settlement: boolean,
  missing: string[],
  settlementEnd?: Date,
) {
  const tenantSegments = electricity.tenantBreakdown.filter(
    (segment) => segment.tenancyId === tenancyId,
  );
  const tenantKwh = tenantSegments.reduce(
    (sum, segment) => sum.plus(segment.usage),
    new Prisma.Decimal(0),
  );
  const settlementBoundaryReady =
    settlement &&
    tenantSegments.some(
      (segment) =>
        settlementEnd && segment.endDate.getTime() === settlementEnd.getTime(),
    );
  if (
    (!settlement && electricity.completeness !== "COMPLETE") ||
    (settlement && !settlementBoundaryReady)
  ) {
    missing.push(
      settlement
        ? "Missing move-out electricity boundary"
        : `${billingIssue(electricity.reason)} for ${monthName(sourceMonth)}`,
    );
  }
  if (tenantSegments.length && !electricity.applicableRate)
    missing.push(`Missing electricity rate for ${monthName(sourceMonth)}`);
  const allTenantKwh = new Prisma.Decimal(
    electricity.totalAttributableUsage ?? tenantKwh,
  );
  const otherTenancyKwh = Prisma.Decimal.max(allTenantKwh.minus(tenantKwh), 0);
  const electricityCalculated = electricity.applicableRate
    ? tenantKwh.mul(electricity.applicableRate)
    : null;
  const lines = [];
  if (tenantSegments.length) {
    const serviceStart = tenantSegments.reduce(
      (earliest, segment) =>
        segment.startDate < earliest ? segment.startDate : earliest,
      tenantSegments[0].startDate,
    );
    const serviceEnd = tenantSegments.reduce(
      (latest, segment) =>
        segment.endDate > latest ? segment.endDate : latest,
      tenantSegments[0].endDate,
    );
    lines.push({
      type: "ELECTRICITY" as const,
      description: `Electricity · ${money(tenantKwh)} billable kWh`,
      sourceBillingMonth: sourceMonth,
      servicePeriodStart: serviceStart,
      servicePeriodEnd: serviceEnd,
      calculatedAmount: electricityCalculated
        ? money(electricityCalculated)
        : null,
      finalAmount: electricityCalculated
        ? money(roundVnd(electricityCalculated))
        : null,
      metadata: {
        tenantKwh: money(tenantKwh),
        applicableRate: electricity.applicableRate,
        rateOverridden: electricity.rateOverridden,
        overrideReason: electricity.overrideReason,
        tenantSegments,
        physicalUsage: electricity.totalPhysicalUsage,
        vacantUsage: electricity.vacantUsage,
        otherTenancyUsage: money(otherTenancyKwh),
        settlement,
        meterSegments: electricity.meterSegments.map((segment) => ({
          meterId: segment.meterId,
          meterNumber: segment.meterNumber,
          usage: segment.physicalUsage,
          openingReading: segment.openingReading
            ? {
                value: segment.openingReading.readingValue,
                date: toDateOnly(segment.openingReading.readingDate),
                type: segment.openingReading.readingType,
                billingMonth: segment.openingReading.billingMonth
                  ? toDateOnly(segment.openingReading.billingMonth)
                  : null,
                source: segment.openingReading.source,
              }
            : null,
          closingReading: segment.closingReading
            ? {
                value: segment.closingReading.readingValue,
                date: toDateOnly(segment.closingReading.readingDate),
                type: segment.closingReading.readingType,
                billingMonth: segment.closingReading.billingMonth
                  ? toDateOnly(segment.closingReading.billingMonth)
                  : null,
                source: segment.closingReading.source,
              }
            : null,
          hasEstimatedReading: segment.hasEstimatedReading,
        })),
      },
    });
  }

  const waterOccupants = water.occupants.filter(
    (occupant) => occupant.tenancyId === tenancyId,
  );
  if (waterOccupants.length && !water.applicableRate)
    missing.push(`Missing water rate for ${monthName(sourceMonth)}`);
  const waterCalculated = water.applicableRate
    ? waterOccupants.reduce(
        (sum, occupant) => sum.plus(occupant.amount ?? 0),
        new Prisma.Decimal(0),
      )
    : null;
  const waterFinal = waterCalculated ? roundVnd(waterCalculated) : null;
  let allocatedWater = new Prisma.Decimal(0);
  const totalOccupantDays = waterOccupants.reduce(
    (sum, occupant) => sum + occupant.billableDays,
    0,
  );
  const occupants = waterOccupants.map((occupant, index) => {
    const finalContribution = waterFinal
      ? index === waterOccupants.length - 1
        ? waterFinal.minus(allocatedWater)
        : roundVnd(new Prisma.Decimal(occupant.amount ?? 0))
      : null;
    if (finalContribution)
      allocatedWater = allocatedWater.plus(finalContribution);
    return {
      personName: occupant.personName,
      role: occupant.role,
      fullMonth: occupant.fullMonth,
      billableDays: occupant.billableDays,
      share: totalOccupantDays
        ? new Prisma.Decimal(occupant.billableDays)
            .div(totalOccupantDays)
            .mul(100)
            .toFixed(2)
        : "0",
      exactAmount: occupant.amount,
      finalContribution: finalContribution ? money(finalContribution) : null,
      serviceStart: toDateOnly(occupant.serviceStart),
      serviceEnd: toDateOnly(occupant.serviceEnd),
    };
  });
  if (waterOccupants.length) {
    const serviceStart = waterOccupants.reduce(
      (earliest, occupant) =>
        occupant.serviceStart < earliest ? occupant.serviceStart : earliest,
      waterOccupants[0].serviceStart,
    );
    const serviceEnd = waterOccupants.reduce(
      (latest, occupant) =>
        occupant.serviceEnd > latest ? occupant.serviceEnd : latest,
      waterOccupants[0].serviceEnd,
    );
    lines.push({
      type: "WATER" as const,
      description: `Water · ${waterOccupants.length} billable ${waterOccupants.length === 1 ? "person" : "people"}`,
      sourceBillingMonth: sourceMonth,
      servicePeriodStart: serviceStart,
      servicePeriodEnd: serviceEnd,
      calculatedAmount: waterCalculated ? money(waterCalculated) : null,
      finalAmount: waterFinal ? money(waterFinal) : null,
      metadata: {
        applicableRate: water.applicableRate,
        totalOccupantDays,
        occupants,
      },
    });
  }
  return lines;
}

function monthName(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

const invoiceInclude = {
  lines: { orderBy: { type: "asc" as const } },
  adjustments: { orderBy: { createdAt: "asc" as const } },
  payments: {
    orderBy: [{ paymentDate: "desc" as const }, { createdAt: "desc" as const }],
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export async function getInvoices(propertyId: string, month?: string | Date) {
  const billingPeriod = month ? monthStart(date(month)) : undefined;
  const invoices = await prisma.invoice.findMany({
    where: {
      tenancy: { space: { floor: { propertyId } } },
      ...(billingPeriod ? { billingPeriod } : {}),
    },
    orderBy: [
      { billingPeriod: "desc" },
      { roomNameSnapshot: "asc" },
      { createdAt: "asc" },
    ],
    include: invoiceInclude,
  });
  return invoices.map(projectInvoice);
}

export async function getInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceInclude,
  });
  return invoice ? projectInvoice(invoice) : null;
}

function projectInvoice(invoice: InvoiceRow) {
  const total = invoice.lines
    .reduce((sum, line) => sum.plus(line.finalAmount), new Prisma.Decimal(0))
    .plus(
      invoice.adjustments.reduce(
        (sum, adjustment) =>
          adjustment.type === "CHARGE"
            ? sum.plus(adjustment.amount)
            : sum.minus(adjustment.amount),
        new Prisma.Decimal(0),
      ),
    );
  const paid = invoice.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );
  const balance = total.minus(paid);
  return {
    id: invoice.id,
    tenancyId: invoice.tenancyId,
    billingPeriod: invoice.billingPeriod,
    invoiceDate: invoice.invoiceDate,
    type: invoice.type,
    serviceStart: invoice.serviceStart,
    serviceEnd: invoice.serviceEnd,
    status: invoice.status,
    propertyName: invoice.propertyNameSnapshot,
    room: invoice.roomNameSnapshot,
    renterName: invoice.renterNameSnapshot,
    finalizedAt: invoice.finalizedAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    lines: invoice.lines.map((line) => ({
      ...line,
      calculatedAmount: money(line.calculatedAmount),
      finalAmount: money(line.finalAmount),
    })),
    adjustments: invoice.adjustments.map((adjustment) => ({
      ...adjustment,
      amount: money(adjustment.amount),
      signedAmount:
        adjustment.type === "CHARGE"
          ? money(adjustment.amount)
          : money(adjustment.amount.negated()),
    })),
    payments: invoice.payments.map((payment) => ({
      ...payment,
      amount: money(payment.amount),
    })),
    total: money(total),
    totalPaid: money(paid),
    balance: money(balance),
    paymentStatus: paid.isZero()
      ? ("UNPAID" as const)
      : balance.isZero()
        ? ("PAID" as const)
        : ("PARTIAL" as const),
  };
}
