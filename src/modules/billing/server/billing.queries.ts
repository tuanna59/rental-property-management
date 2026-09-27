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
  const billingPeriod = monthStart(date(month));
  const monthEnd = monthEndExclusive(billingPeriod);
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
        select: { id: true, status: true },
      },
    },
  });
  const [water, electricityPairs] = await Promise.all([
    getWaterPreview(propertyId, billingPeriod),
    Promise.all(
      [...new Set(tenancies.map((item) => item.space.id))].map(
        async (spaceId) =>
          [
            spaceId,
            await getElectricityPreview(spaceId, billingPeriod),
          ] as const,
      ),
    ),
  ]);
  const electricityBySpace = new Map(electricityPairs);
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return tenancies.map((tenancy) => {
    const serviceStart =
      tenancy.moveInDate > billingPeriod ? tenancy.moveInDate : billingPeriod;
    const serviceEnd =
      tenancy.moveOutDate && tenancy.moveOutDate < monthEnd
        ? tenancy.moveOutDate
        : monthEnd;
    const fullMonth =
      serviceStart.getTime() === billingPeriod.getTime() &&
      serviceEnd.getTime() === monthEnd.getTime();
    const billableDays = fullMonth
      ? 30
      : Math.max(
          0,
          Math.round((serviceEnd.getTime() - serviceStart.getTime()) / DAY),
        );
    const rentCalculated = fullMonth
      ? new Prisma.Decimal(tenancy.monthlyRentVnd.toString())
      : new Prisma.Decimal(tenancy.monthlyRentVnd.toString())
          .div(30)
          .mul(billableDays);
    const electricity = electricityBySpace.get(tenancy.space.id)!;
    const tenantSegments = electricity.tenantBreakdown.filter(
      (segment) => segment.tenancyId === tenancy.id,
    );
    const tenantKwh = tenantSegments.reduce(
      (sum, segment) => sum.plus(segment.usage),
      new Prisma.Decimal(0),
    );
    const allTenantKwh = new Prisma.Decimal(
      electricity.totalAttributableUsage ?? 0,
    );
    const otherTenancyKwh = Prisma.Decimal.max(
      allTenantKwh.minus(tenantKwh),
      0,
    );
    const electricityCalculated = electricity.applicableRate
      ? tenantKwh.mul(electricity.applicableRate)
      : null;
    const waterOccupants = water.occupants.filter(
      (occupant) => occupant.tenancyId === tenancy.id,
    );
    const waterCalculated = water.applicableRate
      ? waterOccupants.reduce(
          (sum, occupant) => sum.plus(occupant.amount ?? 0),
          new Prisma.Decimal(0),
        )
      : null;
    const waterFinal = waterCalculated ? roundVnd(waterCalculated) : null;
    let allocatedWater = new Prisma.Decimal(0);
    const waterOccupantSnapshots = waterOccupants.map((occupant, index) => {
      const finalContribution = waterFinal
        ? index === waterOccupants.length - 1
          ? waterFinal.minus(allocatedWater)
          : roundVnd(new Prisma.Decimal(occupant.amount ?? 0))
        : null;
      if (finalContribution) allocatedWater = allocatedWater.plus(finalContribution);
      return {
        personName: occupant.personName,
        role: occupant.role,
        fullMonth: occupant.fullMonth,
        billableDays: occupant.billableDays,
        exactAmount: occupant.amount,
        finalContribution: finalContribution ? money(finalContribution) : null,
        serviceStart: toDateOnly(occupant.serviceStart),
        serviceEnd: toDateOnly(occupant.serviceEnd),
      };
    });
    const existing = tenancy.invoices[0] ?? null;
    const missing: string[] = [];
    if (electricity.completeness !== "COMPLETE")
      missing.push(billingIssue(electricity.reason));
    if (waterOccupants.length && !water.applicableRate)
      missing.push("Missing water rate");
    const readiness =
      serviceStart > today
        ? "UPCOMING"
        : serviceEnd > today
          ? "IN_PROGRESS"
          : missing.length
            ? "MISSING_DATA"
            : "READY";
    const lifecycle = existing ? existing.status : readiness;
    const renterName = tenancy.occupants[0]?.person.fullName ?? "Tenant";
    return {
      tenancyId: tenancy.id,
      invoiceId: existing?.id ?? null,
      status: lifecycle as
        | "UPCOMING"
        | "IN_PROGRESS"
        | "MISSING_DATA"
        | "READY"
        | "DRAFT"
        | "FINALIZED",
      readiness: readiness as
        "UPCOMING" | "IN_PROGRESS" | "MISSING_DATA" | "READY",
      propertyName: tenancy.space.floor.property.name,
      room: tenancy.space.name,
      renterName,
      billingPeriod,
      serviceStart,
      serviceEnd,
      missing,
      lines: [
        {
          type: "RENT" as const,
          description: fullMonth
            ? "Monthly rent"
            : `Prorated rent · ${billableDays} days`,
          calculatedAmount: money(rentCalculated),
          finalAmount: money(roundVnd(rentCalculated)),
          metadata: {
            monthlyRentVnd: tenancy.monthlyRentVnd.toString(),
            fullMonth,
            billableDays,
            serviceStart: toDateOnly(serviceStart),
            serviceEnd: toDateOnly(serviceEnd),
          },
        },
        {
          type: "ELECTRICITY" as const,
          description: `Electricity · ${money(tenantKwh)} billable kWh`,
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
            meterSegments: electricity.meterSegments.map((segment) => ({
              meterNumber: segment.meterNumber,
              usage: segment.physicalUsage,
              installedAt: toDateOnly(segment.installedAt),
              removedAt: segment.removedAt
                ? toDateOnly(segment.removedAt)
                : null,
              openingReading: segment.openingReading
                ? {
                    value: segment.openingReading.readingValue,
                    date: toDateOnly(segment.openingReading.readingDate),
                    type: segment.openingReading.readingType,
                    source: segment.openingReading.source,
                  }
                : null,
              closingReading: segment.closingReading
                ? {
                    value: segment.closingReading.readingValue,
                    date: toDateOnly(segment.closingReading.readingDate),
                    type: segment.closingReading.readingType,
                    source: segment.closingReading.source,
                  }
                : null,
              hasEstimatedReading: segment.hasEstimatedReading,
            })),
          },
        },
        {
          type: "WATER" as const,
          description: `Water · ${waterOccupants.length} billable ${waterOccupants.length === 1 ? "person" : "people"}`,
          calculatedAmount: waterCalculated ? money(waterCalculated) : null,
          finalAmount: waterFinal ? money(waterFinal) : null,
          metadata: {
            applicableRate: water.applicableRate,
            occupants: waterOccupantSnapshots,
          },
        },
      ],
    };
  });
}

const invoiceInclude = {
  lines: { orderBy: { type: "asc" as const } },
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
  const total = invoice.lines.reduce(
    (sum, line) => sum.plus(line.finalAmount),
    new Prisma.Decimal(0),
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
