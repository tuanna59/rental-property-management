import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/presentation";
import { roundVnd } from "@/lib/money";

import { monthEndExclusive, monthStart } from "../domain/rules";
import { date } from "../domain/validation";

const decimal = (value: Prisma.Decimal) => value.toString();
const sameDay = (left: Date, right: Date) => left.getTime() === right.getTime();

async function rateAt(
  propertyId: string,
  utilityType: "ELECTRICITY" | "WATER",
  at: Date,
) {
  return prisma.utilityRate.findFirst({
    where: {
      propertyId,
      utilityType,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true, rate: true, effectiveFrom: true },
  });
}

const readingSelect = {
  id: true,
  readingDate: true,
  billingMonth: true,
  readingValue: true,
  readingType: true,
  source: true,
  photoStorageKey: true,
  notes: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.MeterReadingSelect;

type ReadingRow = Prisma.MeterReadingGetPayload<{
  select: typeof readingSelect;
}>;

function readingProjection(reading: ReadingRow) {
  return {
    id: reading.id,
    readingDate: reading.readingDate,
    billingMonth: reading.billingMonth,
    readingValue: decimal(reading.readingValue),
    readingType: reading.readingType,
    source: reading.source,
    hasPhoto: Boolean(reading.photoStorageKey),
    notes: reading.notes,
    reason: reading.reason,
  };
}

function readingOrder(left: ReadingRow, right: ReadingRow) {
  const dateOrder = left.readingDate.getTime() - right.readingDate.getTime();
  if (dateOrder) return dateOrder;
  const priority = {
    METER_INSTALL: 0,
    MOVE_OUT: 1,
    MOVE_IN: 2,
    MANUAL: 3,
    MONTHLY: 4,
    METER_REMOVAL: 5,
  } as const;
  const typeOrder = priority[left.readingType] - priority[right.readingType];
  return typeOrder || left.createdAt.getTime() - right.createdAt.getTime();
}

type TenancyRow = {
  id: string;
  moveInDate: Date;
  moveOutDate: Date | null;
  occupants: Array<{
    role: "RESPONSIBLE" | "ADDITIONAL";
    person: { fullName: string };
  }>;
};

function tenancyName(tenancy: TenancyRow) {
  return (
    tenancy.occupants.find((occupant) => occupant.role === "RESPONSIBLE")
      ?.person.fullName ?? "Tenant"
  );
}

function activeTenancyAt(tenancies: TenancyRow[], at: Date) {
  return (
    tenancies.find(
      (tenancy) =>
        tenancy.moveInDate <= at &&
        (!tenancy.moveOutDate || tenancy.moveOutDate > at),
    ) ?? null
  );
}

function computePhysicalMeterSegment(
  meter: {
    id: string;
    meterNumber: string | null;
    installedAt: Date;
    removedAt: Date | null;
    readings: ReadingRow[];
  },
  tenancies: TenancyRow[],
  start: Date,
  end: Date,
) {
  const readings = [...meter.readings].sort(readingOrder);
  const monthlyReading = readings.find(
    (reading) =>
      reading.readingType === "MONTHLY" &&
      reading.billingMonth &&
      sameDay(reading.billingMonth, start),
  );
  const priorMonthly = readings
    .filter(
      (reading) =>
        reading.readingType === "MONTHLY" &&
        reading.billingMonth &&
        reading.billingMonth < start,
    )
    .at(-1);
  const startReading =
    meter.installedAt >= start
      ? readings.find(
          (reading) =>
            reading.readingType === "METER_INSTALL" &&
            sameDay(reading.readingDate, meter.installedAt),
        )
      : (priorMonthly ??
        readings.filter((reading) => reading.readingDate <= start).at(-1));
  const removalReading =
    meter.removedAt && meter.removedAt < end
      ? readings.find(
          (reading) =>
            reading.readingType === "METER_REMOVAL" &&
            sameDay(reading.readingDate, meter.removedAt!),
        )
      : undefined;
  const endReading = removalReading ?? monthlyReading;
  const knownEndReading =
    endReading ??
    readings
      .filter(
        (reading) =>
          Boolean(startReading) &&
          reading.id !== startReading?.id &&
          (reading.readingType !== "MONTHLY" ||
            !reading.billingMonth ||
            reading.billingMonth <= start) &&
          reading.readingDate >= startReading!.readingDate &&
          reading.readingDate < monthEndExclusive(end),
      )
      .at(-1);
  const segmentStart =
    startReading?.readingDate ??
    (meter.installedAt > start ? meter.installedAt : start);
  const segmentEnd = knownEndReading?.readingDate ?? end;

  const relevantTenancies = tenancies.filter(
    (tenancy) =>
      tenancy.moveInDate < segmentEnd &&
      (!tenancy.moveOutDate || tenancy.moveOutDate > segmentStart),
  );
  const missingBoundary: Array<{
    tenancyId: string;
    boundaryType: "MOVE_IN" | "MOVE_OUT";
    boundaryDate: Date;
    tenantName: string;
    meterId: string;
    meterNumber: string | null;
    message: string;
  }> = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const tenancy of relevantTenancies) {
    if (
      tenancy.moveInDate > segmentStart &&
      tenancy.moveInDate <= segmentEnd &&
      tenancy.moveInDate <= today &&
      !readings.some(
        (reading) =>
          reading.readingType === "MOVE_IN" &&
          sameDay(reading.readingDate, tenancy.moveInDate),
      ) &&
      !readings.some(
        (reading) =>
          reading.readingType === "MOVE_OUT" &&
          sameDay(reading.readingDate, tenancy.moveInDate),
      )
    ) {
      missingBoundary.push({
        tenancyId: tenancy.id,
        boundaryType: "MOVE_IN",
        boundaryDate: tenancy.moveInDate,
        tenantName: tenancyName(tenancy),
        meterId: meter.id,
        meterNumber: meter.meterNumber,
        message: `Missing move-in reading for ${tenancyName(tenancy)} on ${toDateOnly(tenancy.moveInDate)}`,
      });
    }
    if (
      tenancy.moveOutDate &&
      tenancy.moveOutDate > segmentStart &&
      tenancy.moveOutDate <= segmentEnd &&
      tenancy.moveOutDate <= today &&
      !readings.some(
        (reading) =>
          reading.readingType === "MOVE_OUT" &&
          sameDay(reading.readingDate, tenancy.moveOutDate!),
      )
    ) {
      missingBoundary.push({
        tenancyId: tenancy.id,
        boundaryType: "MOVE_OUT",
        boundaryDate: tenancy.moveOutDate,
        tenantName: tenancyName(tenancy),
        meterId: meter.id,
        meterNumber: meter.meterNumber,
        message: `Missing move-out reading for ${tenancyName(tenancy)} on ${toDateOnly(tenancy.moveOutDate)}`,
      });
    }
  }

  if (!startReading || !knownEndReading) {
    return {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      installedAt: meter.installedAt,
      removedAt: meter.removedAt,
      complete: false,
      reason: !startReading
        ? "Missing opening reading for this physical meter segment."
        : "No usage reading is available for this physical meter segment.",
      isClosingComplete: false,
      physicalUsage: null,
      openingReading: startReading ? readingProjection(startReading) : null,
      closingReading: knownEndReading
        ? readingProjection(knownEndReading)
        : null,
      hasEstimatedReading: false,
      tenantUsage: null,
      vacantUsage: null,
      sourceReadingIds: [] as string[],
      tenantUsageSegments: [] as Array<{
        kind: "TENANT" | "VACANT";
        tenancyId: string | null;
        label: string;
        usage: string;
        startDate: Date;
        endDate: Date;
        usageKnown: boolean;
        isOpen: boolean;
      }>,
      missingBoundary,
    };
  }

  if (missingBoundary.length) {
    return {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      installedAt: meter.installedAt,
      removedAt: meter.removedAt,
      complete: false,
      isClosingComplete: Boolean(endReading),
      reason: missingBoundary[0].message,
      physicalUsage: decimal(
        knownEndReading.readingValue.minus(startReading.readingValue),
      ),
      openingReading: readingProjection(startReading),
      closingReading: readingProjection(knownEndReading),
      hasEstimatedReading:
        startReading.source === "ESTIMATED" ||
        knownEndReading.source === "ESTIMATED",
      tenantUsage: null,
      vacantUsage: null,
      sourceReadingIds: [startReading.id, knownEndReading.id],
      tenantUsageSegments: startReading
        ? [
            {
              kind: activeTenancyAt(relevantTenancies, startReading.readingDate)
                ? ("TENANT" as const)
                : ("VACANT" as const),
              tenancyId:
                activeTenancyAt(relevantTenancies, startReading.readingDate)
                  ?.id ?? null,
              label: activeTenancyAt(
                relevantTenancies,
                startReading.readingDate,
              )
                ? tenancyName(
                    activeTenancyAt(
                      relevantTenancies,
                      startReading.readingDate,
                    )!,
                  )
                : "Vacant",
              usage: "0",
              startDate: startReading.readingDate,
              endDate: end,
              usageKnown: false,
              isOpen: true,
            },
          ]
        : [],
      missingBoundary,
    };
  }

  const boundaryReadings = readings.filter(
    (reading) =>
      (reading.readingType === "MOVE_IN" ||
        reading.readingType === "MOVE_OUT") &&
      reading.readingDate >= segmentStart &&
      reading.readingDate <= knownEndReading.readingDate &&
      reading.id !== startReading.id &&
      reading.id !== knownEndReading.id,
  );
  const timeline = [startReading, ...boundaryReadings, knownEndReading]
    .filter(
      (reading, index, items) =>
        items.findIndex((candidate) => candidate.id === reading.id) === index,
    )
    .sort(readingOrder);
  let active = activeTenancyAt(relevantTenancies, segmentStart);
  const usageSegments: Array<{
    kind: "TENANT" | "VACANT";
    tenancyId: string | null;
    label: string;
    usage: Prisma.Decimal;
    startDate: Date;
    endDate: Date;
    usageKnown: boolean;
    isOpen: boolean;
  }> = [];
  for (let index = 1; index < timeline.length; index += 1) {
    const previous = timeline[index - 1];
    const current = timeline[index];
    const usage = current.readingValue.minus(previous.readingValue);
    if (usage.isNegative()) {
      return {
        meterId: meter.id,
        meterNumber: meter.meterNumber,
        installedAt: meter.installedAt,
        removedAt: meter.removedAt,
        complete: false,
        reason: "Readings decrease inside this physical meter segment.",
        physicalUsage: null,
        openingReading: readingProjection(startReading),
        closingReading: readingProjection(knownEndReading),
        hasEstimatedReading: timeline.some(
          (reading) => reading.source === "ESTIMATED",
        ),
        tenantUsage: null,
        vacantUsage: null,
        sourceReadingIds: timeline.map((reading) => reading.id),
        tenantUsageSegments: [],
        isClosingComplete: Boolean(endReading),
        missingBoundary,
      };
    }
    usageSegments.push({
      kind: active ? "TENANT" : "VACANT",
      tenancyId: active?.id ?? null,
      label: active ? tenancyName(active) : "Vacant",
      usage,
      startDate: previous.readingDate,
      endDate: current.readingDate,
      usageKnown: true,
      isOpen: false,
    });
    if (current.readingType === "MOVE_OUT") {
      active =
        relevantTenancies.find(
          (tenancy) =>
            tenancy.id !== active?.id &&
            sameDay(tenancy.moveInDate, current.readingDate),
        ) ?? null;
    } else if (current.readingType === "MOVE_IN") {
      active =
        relevantTenancies.find((tenancy) =>
          sameDay(tenancy.moveInDate, current.readingDate),
        ) ?? null;
    }
  }
  if (!endReading && knownEndReading.readingDate < end) {
    usageSegments.push({
      kind: active ? "TENANT" : "VACANT",
      tenancyId: active?.id ?? null,
      label: active ? tenancyName(active) : "Vacant",
      usage: new Prisma.Decimal(0),
      startDate: knownEndReading.readingDate,
      endDate: end,
      usageKnown: false,
      isOpen: true,
    });
  }
  const physicalUsage = knownEndReading.readingValue.minus(
    startReading.readingValue,
  );
  const tenantUsage = usageSegments
    .filter((segment) => segment.kind === "TENANT")
    .reduce((sum, segment) => sum.plus(segment.usage), new Prisma.Decimal(0));
  const vacantUsage = usageSegments
    .filter((segment) => segment.kind === "VACANT")
    .reduce((sum, segment) => sum.plus(segment.usage), new Prisma.Decimal(0));
  return {
    meterId: meter.id,
    meterNumber: meter.meterNumber,
    installedAt: meter.installedAt,
    removedAt: meter.removedAt,
    complete: Boolean(endReading),
    isClosingComplete: Boolean(endReading),
    reason: endReading
      ? null
      : "Closing monthly reading is missing; usage is known so far.",
    physicalUsage: decimal(physicalUsage),
    openingReading: readingProjection(startReading),
    closingReading: readingProjection(knownEndReading),
    hasEstimatedReading: timeline.some(
      (reading) => reading.source === "ESTIMATED",
    ),
    tenantUsage: decimal(tenantUsage),
    vacantUsage: decimal(vacantUsage),
    sourceReadingIds: timeline.map((reading) => reading.id),
    tenantUsageSegments: usageSegments.map((segment) => ({
      ...segment,
      usage: decimal(segment.usage),
    })),
    missingBoundary,
  };
}

async function getMonthlySpaces(propertyId: string, start: Date, end: Date) {
  return prisma.space.findMany({
    where: {
      type: "ROOM",
      archivedAt: null,
      floor: { propertyId, archivedAt: null },
    },
    orderBy: [{ floor: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      meters: {
        where: {
          type: "ELECTRICITY",
          installedAt: { lt: end },
          OR: [{ removedAt: null }, { removedAt: { gt: start } }],
        },
        orderBy: { installedAt: "asc" },
        select: {
          id: true,
          meterNumber: true,
          installedAt: true,
          removedAt: true,
          notes: true,
          readings: {
            orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
            select: readingSelect,
          },
        },
      },
      tenancies: {
        orderBy: { moveInDate: "asc" },
        select: {
          id: true,
          moveInDate: true,
          moveOutDate: true,
          occupants: {
            where: { role: "RESPONSIBLE" },
            take: 1,
            select: {
              role: true,
              person: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });
}

export async function getSpaceMeterHistory(spaceId: string) {
  const meters = await prisma.meter.findMany({
    where: { spaceId, type: "ELECTRICITY" },
    orderBy: { installedAt: "desc" },
    select: {
      id: true,
      meterNumber: true,
      installedAt: true,
      removedAt: true,
      notes: true,
      readings: {
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: readingSelect,
      },
    },
  });
  return meters.map((meter) => ({
    ...meter,
    latestReading: meter.readings[0]
      ? readingProjection(meter.readings[0])
      : null,
    readings: meter.readings.map(readingProjection),
  }));
}

export async function getMonthlyMeterEntries(
  propertyId: string,
  month: string | Date,
) {
  const start = monthStart(date(month));
  const end = monthEndExclusive(start);
  const spaces = await getMonthlySpaces(propertyId, start, end);
  const histories = await prisma.meter.findMany({
    where: {
      spaceId: { in: spaces.map((space) => space.id) },
      type: "ELECTRICITY",
    },
    orderBy: { installedAt: "desc" },
    select: {
      id: true,
      spaceId: true,
      meterNumber: true,
      installedAt: true,
      removedAt: true,
      notes: true,
      readings: {
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: readingSelect,
      },
    },
  });

  return spaces.map((space) => {
    const activeMeter =
      [...space.meters]
        .reverse()
        .find((meter) => !meter.removedAt || meter.removedAt >= end) ??
      space.meters.at(-1) ??
      null;
    const monthlyReading = activeMeter?.readings.find(
      (reading) =>
        reading.readingType === "MONTHLY" &&
        reading.billingMonth &&
        sameDay(reading.billingMonth, start),
    );
    const targetDate = monthlyReading?.readingDate ?? end;
    const previousReading = activeMeter?.readings
      .filter(
        (reading) =>
          reading.id !== monthlyReading?.id &&
          reading.readingDate <= targetDate,
      )
      .at(-1);
    const meterSegments = space.meters.map((meter) =>
      computePhysicalMeterSegment(meter, space.tenancies, start, end),
    );
    const knownUsage = meterSegments.reduce(
      (sum, segment) => sum.plus(segment.physicalUsage ?? 0),
      new Prisma.Decimal(0),
    );
    const hasKnownUsage = meterSegments.some(
      (segment) => segment.physicalUsage !== null,
    );
    const isClosingComplete =
      meterSegments.length > 0 &&
      meterSegments.every((segment) => segment.isClosingComplete);
    const rawTenancySegments = meterSegments.flatMap(
      (segment) => segment.tenantUsageSegments,
    );
    const tenancySegments = rawTenancySegments.reduce<
      typeof rawTenancySegments
    >((merged, segment) => {
      const previous = merged.at(-1);
      if (
        previous &&
        previous.kind === segment.kind &&
        previous.tenancyId === segment.tenancyId &&
        !previous.isOpen &&
        !segment.isOpen
      ) {
        previous.usage = new Prisma.Decimal(previous.usage)
          .plus(segment.usage)
          .toString();
        previous.endDate = segment.endDate;
        return merged;
      }
      merged.push({ ...segment });
      return merged;
    }, []);
    const missingBoundary = meterSegments.flatMap(
      (segment) => segment.missingBoundary,
    );
    const attributionReady =
      meterSegments.length > 0 &&
      meterSegments.every((segment) => segment.complete);
    const warnings = meterSegments.flatMap((segment) => [
      ...(segment.reason ? [segment.reason] : []),
      ...segment.missingBoundary.map((boundary) => boundary.message),
    ]);
    if (space.meters.length > 1) {
      warnings.push("Meter replaced during the selected month.");
    }
    if (monthlyReading?.source === "ESTIMATED") {
      warnings.push("Monthly reading is estimated.");
    }
    if (activeMeter && !monthlyReading) {
      warnings.push("Monthly reading is missing.");
    }

    return {
      spaceId: space.id,
      room: space.name,
      activeMeter: activeMeter
        ? {
            id: activeMeter.id,
            meterNumber: activeMeter.meterNumber,
            installedAt: activeMeter.installedAt,
            latestReading: activeMeter.readings.at(-1)
              ? readingProjection(activeMeter.readings.at(-1)!)
              : null,
          }
        : null,
      meterId: activeMeter?.id ?? null,
      meterNumber: activeMeter?.meterNumber ?? null,
      previousReading: previousReading
        ? readingProjection(previousReading)
        : null,
      monthlyReading: monthlyReading ? readingProjection(monthlyReading) : null,
      previous: previousReading ? decimal(previousReading.readingValue) : null,
      current: monthlyReading ? decimal(monthlyReading.readingValue) : null,
      readingDate: monthlyReading?.readingDate ?? null,
      source: monthlyReading?.source ?? "MEASURED",
      billingMonth: start,
      actualReadingDate: monthlyReading?.readingDate ?? null,
      lateReadingDays: monthlyReading
        ? Math.max(
            0,
            Math.round(
              (monthlyReading.readingDate.getTime() -
                (end.getTime() - 86_400_000)) /
                86_400_000,
            ),
          )
        : null,
      monthlyPhysicalUsage:
        isClosingComplete && hasKnownUsage ? decimal(knownUsage) : null,
      knownPhysicalUsage: hasKnownUsage ? decimal(knownUsage) : null,
      isClosingComplete,
      readingStatus: !activeMeter
        ? ("NO_METER" as const)
        : !monthlyReading
          ? ("MISSING" as const)
          : monthlyReading.source === "ESTIMATED"
            ? ("ESTIMATED" as const)
            : ("RECORDED" as const),
      attributionStatus: attributionReady
        ? ("COMPLETE" as const)
        : ("PARTIAL" as const),
      monthlyCycleStatus: isClosingComplete
        ? ("COMPLETE" as const)
        : ("INCOMPLETE" as const),
      meterSegments,
      tenancySegments,
      missingBoundary,
      warnings: [...new Set(warnings)],
      history: histories
        .filter((meter) => meter.spaceId === space.id)
        .map(({ spaceId: _spaceId, ...meter }) => ({
          ...meter,
          latestReading: meter.readings[0]
            ? readingProjection(meter.readings[0])
            : null,
          readings: meter.readings.map(readingProjection),
        })),
    };
  });
}

export async function getElectricityPreview(
  spaceId: string,
  month: string | Date,
) {
  const start = monthStart(date(month));
  const property = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { floor: { select: { propertyId: true } } },
  });
  if (!property) {
    return {
      billingPeriod: start,
      completeness: "INCOMPLETE" as const,
      reason: "Room not found.",
      meterSegments: [],
      tenantBreakdown: [],
      totalAttributableUsage: null,
      totalPhysicalUsage: null,
      vacantUsage: null,
      calculatedAmount: null,
    };
  }
  const entry = (
    await getMonthlyMeterEntries(property.floor.propertyId, start)
  ).find((item) => item.spaceId === spaceId);
  if (!entry || !entry.activeMeter) {
    return {
      billingPeriod: start,
      completeness: "INCOMPLETE" as const,
      reason: "No electricity meter is configured.",
      meterSegments: entry?.meterSegments ?? [],
      tenantBreakdown: [],
      totalAttributableUsage: null,
      totalPhysicalUsage: null,
      vacantUsage: null,
      calculatedAmount: null,
    };
  }
  const complete = entry.meterSegments.every((segment) => segment.complete);
  const tenantUsage = complete
    ? entry.meterSegments.reduce(
        (sum, segment) => sum.plus(segment.tenantUsage ?? 0),
        new Prisma.Decimal(0),
      )
    : null;
  const physicalUsage = complete
    ? entry.meterSegments.reduce(
        (sum, segment) => sum.plus(segment.physicalUsage ?? 0),
        new Prisma.Decimal(0),
      )
    : null;
  const vacantUsage = complete
    ? entry.meterSegments.reduce(
        (sum, segment) => sum.plus(segment.vacantUsage ?? 0),
        new Prisma.Decimal(0),
      )
    : null;
  const override = await prisma.electricityRateOverride.findUnique({
    where: { spaceId_billingMonth: { spaceId, billingMonth: start } },
    select: { rate: true, reason: true },
  });
  const applicable = override
    ? { rate: override.rate }
    : await rateAt(property.floor.propertyId, "ELECTRICITY", start);
  const reason = !complete
    ? (entry.warnings[0] ?? "Monthly attribution is incomplete.")
    : !applicable
      ? "No electricity rate is configured."
      : null;
  return {
    billingPeriod: start,
    completeness: reason ? ("INCOMPLETE" as const) : ("COMPLETE" as const),
    reason,
    meterSegments: entry.meterSegments,
    tenantBreakdown: entry.tenancySegments
      .filter((segment) => segment.kind === "TENANT")
      .map((segment) => ({
        tenancyId: segment.tenancyId,
        tenantName: segment.label,
        usage: segment.usage,
        share:
          tenantUsage && !tenantUsage.isZero()
            ? new Prisma.Decimal(segment.usage)
                .div(tenantUsage)
                .mul(100)
                .toFixed(1)
            : "0",
        amount: applicable
          ? decimal(new Prisma.Decimal(segment.usage).mul(applicable.rate))
          : null,
        startDate: segment.startDate,
        endDate: segment.endDate,
      })),
    totalAttributableUsage: tenantUsage ? decimal(tenantUsage) : null,
    totalPhysicalUsage: physicalUsage ? decimal(physicalUsage) : null,
    vacantUsage: vacantUsage ? decimal(vacantUsage) : null,
    applicableRate: applicable ? decimal(applicable.rate) : null,
    rateOverridden: Boolean(override),
    overrideReason: override?.reason ?? null,
    calculatedAmount:
      tenantUsage && applicable
        ? decimal(tenantUsage.mul(applicable.rate))
        : null,
    finalAmount:
      tenantUsage && applicable
        ? decimal(roundVnd(tenantUsage.mul(applicable.rate)))
        : null,
  };
}

export async function getWaterPreview(
  propertyId: string,
  month: string | Date,
) {
  const start = monthStart(date(month));
  const end = monthEndExclusive(start);
  const rate = await rateAt(propertyId, "WATER", start);
  const occupants = await prisma.tenancyOccupant.findMany({
    where: {
      startDate: { lt: end },
      OR: [{ endDate: null }, { endDate: { gt: start } }],
      tenancy: { space: { floor: { propertyId } } },
    },
    select: {
      id: true,
      role: true,
      person: { select: { fullName: true } },
      startDate: true,
      endDate: true,
      tenancy: {
        select: { id: true, spaceId: true, space: { select: { name: true } } },
      },
    },
  });
  const details = occupants.map((occupant) => {
    const begins = occupant.startDate > start ? occupant.startDate : start;
    const finishes =
      occupant.endDate && occupant.endDate < end ? occupant.endDate : end;
    const fullMonth = sameDay(begins, start) && sameDay(finishes, end);
    const billableDays = fullMonth
      ? 30
      : Math.max(
          0,
          Math.round((finishes.getTime() - begins.getTime()) / 86_400_000),
        );
    return {
      id: occupant.id,
      role: occupant.role,
      personName: occupant.person.fullName,
      tenancyId: occupant.tenancy.id,
      spaceId: occupant.tenancy.spaceId,
      room: occupant.tenancy.space.name,
      startDate: occupant.startDate,
      endDate: occupant.endDate,
      serviceStart: begins,
      serviceEnd: finishes,
      fullMonth,
      billableDays,
      amount: rate
        ? decimal(fullMonth ? rate.rate : rate.rate.div(30).mul(billableDays))
        : null,
    };
  });
  const amount = (items: typeof details) =>
    rate
      ? decimal(
          items.reduce(
            (sum, item) => sum.plus(item.amount ?? 0),
            new Prisma.Decimal(0),
          ),
        )
      : null;
  const roomSummaries = [...new Set(details.map((item) => item.spaceId))].map(
    (spaceId) => {
      const roomDetails = details.filter((item) => item.spaceId === spaceId);
      return {
        spaceId,
        room: roomDetails[0]?.room ?? "Room",
        billablePeople: roomDetails.length,
        occupantDays: roomDetails.reduce(
          (sum, item) => sum + item.billableDays,
          0,
        ),
        occupants: roomDetails,
        calculatedPreviewAmount: amount(roomDetails),
        finalPreviewAmount: rate
          ? decimal(
              roundVnd(
                roomDetails.reduce(
                  (sum, item) => sum.plus(item.amount ?? 0),
                  new Prisma.Decimal(0),
                ),
              ),
            )
          : null,
      };
    },
  );
  return {
    applicableRate: rate ? decimal(rate.rate) : null,
    billablePeople: details.length,
    occupantDays: details.reduce((sum, item) => sum + item.billableDays, 0),
    occupants: details,
    roomSummaries,
    calculatedPreviewAmount: amount(details),
    finalPreviewAmount: rate
      ? decimal(
          roundVnd(
            details.reduce(
              (sum, item) => sum.plus(item.amount ?? 0),
              new Prisma.Decimal(0),
            ),
          ),
        )
      : null,
  };
}

export async function getRates(propertyId: string) {
  const rates = await prisma.utilityRate.findMany({
    where: { propertyId },
    orderBy: [{ utilityType: "asc" }, { effectiveFrom: "desc" }],
  });
  const overrides = await prisma.electricityRateOverride.findMany({
    where: { space: { floor: { propertyId } } },
    include: { space: { select: { name: true } } },
    orderBy: { billingMonth: "desc" },
  });
  return {
    rates: rates.map((rate) => ({ ...rate, rate: decimal(rate.rate) })),
    overrides: overrides.map((override) => ({
      ...override,
      rate: decimal(override.rate),
    })),
  };
}

export async function getUtilitiesOverview(
  propertyId: string,
  month: string | Date,
) {
  const entries = await getMonthlyMeterEntries(propertyId, month);
  const [previews, water] = await Promise.all([
    Promise.all(
      entries.map((entry) => getElectricityPreview(entry.spaceId, month)),
    ),
    getWaterPreview(propertyId, month),
  ]);
  const electricity = entries.map((entry, index) => ({
    ...entry,
    preview: previews[index],
    water: water.roomSummaries.find(
      (summary) => summary.spaceId === entry.spaceId,
    ) ?? {
      spaceId: entry.spaceId,
      room: entry.room,
      billablePeople: 0,
      occupantDays: 0,
      occupants: [],
      calculatedPreviewAmount: water.applicableRate ? "0" : null,
      finalPreviewAmount: water.applicableRate ? "0" : null,
    },
  }));
  const warnings = electricity.flatMap((entry) => {
    const boundaries = new Map(
      entry.missingBoundary.map((boundary) => [boundary.message, boundary]),
    );
    return entry.warnings.map((message) => ({
      spaceId: entry.spaceId,
      room: entry.room,
      message,
      boundary: boundaries.get(message) ?? null,
    }));
  });
  return {
    electricity,
    monthlyReadingsRecorded: entries.filter(
      (entry) =>
        entry.readingStatus === "RECORDED" ||
        entry.readingStatus === "ESTIMATED",
    ).length,
    monthlyReadingsRequired: entries.filter((entry) => entry.activeMeter)
      .length,
    attributionReady: entries.filter(
      (entry) => entry.activeMeter && entry.attributionStatus === "COMPLETE",
    ).length,
    attributionRequired: entries.filter((entry) => entry.activeMeter).length,
    warnings,
    water,
  };
}
