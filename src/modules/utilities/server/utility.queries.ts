import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/presentation";
import { roundVnd } from "@/lib/money";

import { monthEndExclusive, monthStart } from "../domain/rules";
import {
  isMonthlyClosingRequired,
  resolveClosingDateQuality,
  resolveMonthlyClosingCandidate,
} from "../domain/monthly-closing";
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

async function overrideAt(
  spaceId: string,
  utilityType: "ELECTRICITY" | "WATER",
  at: Date,
) {
  return prisma.utilityRateOverride.findFirst({
    where: {
      spaceId,
      utilityType,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: {
      id: true,
      rate: true,
      reason: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
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
  monthlyClosings: {
    orderBy: { billingMonth: "desc" },
    select: { billingMonth: true },
  },
  evidencePhotos: { select: { id: true, storageKey: true } },
  invoiceEvidence: {
    where: { invoice: { status: "FINALIZED" } },
    select: {
      invoice: {
        select: {
          id: true,
          type: true,
          billingPeriod: true,
          roomNameSnapshot: true,
        },
      },
    },
  },
} satisfies Prisma.MeterReadingSelect;

type ReadingRow = Prisma.MeterReadingGetPayload<{
  select: typeof readingSelect;
}>;

function readingProjection(reading: ReadingRow) {
  const closingMonths = reading.monthlyClosings.map(
    (closing) => closing.billingMonth,
  );
  const closingMonth = closingMonths[0] ?? null;
  const lockedBy = reading.invoiceEvidence[0]?.invoice ?? null;
  const lifecycleManaged = [
    "MOVE_IN",
    "MOVE_OUT",
    "METER_INSTALL",
    "METER_REMOVAL",
  ].includes(reading.readingType);
  return {
    id: reading.id,
    readingDate: reading.readingDate,
    billingMonth: closingMonth,
    closingMonths,
    legacyBillingMonth: reading.billingMonth,
    readingValue: decimal(reading.readingValue),
    readingType: reading.readingType,
    source: reading.source,
    hasPhoto:
      Boolean(reading.photoStorageKey) || reading.evidencePhotos.length > 0,
    photoCount: new Set(
      [
        ...reading.evidencePhotos.map((photo) => photo.storageKey),
        reading.photoStorageKey,
      ].filter((key): key is string => Boolean(key)),
    ).size,
    notes: reading.notes,
    reason: reading.reason,
    isClosing: closingMonths.length > 0,
    isLocked: Boolean(lockedBy),
    isManaged: lifecycleManaged,
    lockInvoice: lockedBy,
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
  const closingAssignments = readings.flatMap((reading) =>
    reading.monthlyClosings.map((closing) => ({
      billingMonth: closing.billingMonth,
      reading,
    })),
  );
  const monthlyReading = closingAssignments.find((closing) =>
    sameDay(closing.billingMonth, start),
  )?.reading;
  const previousClosing = closingAssignments
    .filter((closing) => closing.billingMonth < start)
    .sort(
      (left, right) =>
        right.billingMonth.getTime() - left.billingMonth.getTime(),
    )[0]?.reading;

  const installReading = readings.find(
    (reading) =>
      reading.readingType === "METER_INSTALL" &&
      sameDay(reading.readingDate, meter.installedAt),
  );
  const priorPhysicalReading = readings
    .filter(
      (reading) =>
        reading.readingDate < start &&
        !reading.monthlyClosings.some((closing) => closing.billingMonth >= start),
    )
    .at(-1);
  const readingAtCycleStart = readings.find(
    (reading) =>
      sameDay(reading.readingDate, start) &&
      !reading.monthlyClosings.some((closing) => closing.billingMonth > start),
  );
  const startReading =
    meter.installedAt >= start
      ? installReading
      : (previousClosing ?? readingAtCycleStart ?? priorPhysicalReading);

  const removalReading =
    meter.removedAt && meter.removedAt < end
      ? readings.find(
          (reading) =>
            reading.readingType === "METER_REMOVAL" &&
            sameDay(reading.readingDate, meter.removedAt!),
        )
      : undefined;
  const billingEndReading = removalReading ?? monthlyReading;
  const knownWindowEnd =
    monthlyReading && monthlyReading.readingDate > end
      ? monthlyReading.readingDate
      : end;
  const knownEndReading = startReading
    ? readings
        .filter(
          (reading) =>
            reading.id !== startReading.id &&
            reading.readingDate >= startReading.readingDate &&
            reading.readingDate <= knownWindowEnd,
        )
        .at(-1)
    : undefined;
  const attributionEndReading = billingEndReading ?? knownEndReading;
  const segmentStart =
    startReading?.readingDate ??
    (meter.installedAt > start ? meter.installedAt : start);
  const boundaryCheckEnd = billingEndReading
    ? billingEndReading.readingDate
    : meter.removedAt && meter.removedAt < end
      ? meter.removedAt
      : knownWindowEnd;

  const relevantTenancies = tenancies.filter(
    (tenancy) =>
      tenancy.moveInDate <= boundaryCheckEnd &&
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
      tenancy.moveInDate <= boundaryCheckEnd &&
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
      tenancy.moveOutDate <= boundaryCheckEnd &&
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

  const emptySegments = [] as Array<{
    kind: "TENANT" | "VACANT";
    tenancyId: string | null;
    label: string;
    usage: string;
    startDate: Date;
    endDate: Date;
    usageKnown: boolean;
    isOpen: boolean;
  }>;

  if (!startReading) {
    return {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      installedAt: meter.installedAt,
      removedAt: meter.removedAt,
      complete: false,
      reason: "Missing opening reading for this physical meter segment.",
      invalidChronology: false,
      isClosingComplete: Boolean(monthlyReading),
      physicalUsage: null,
      knownPhysicalUsage: null,
      openingReading: null,
      closingReading: billingEndReading
        ? readingProjection(billingEndReading)
        : null,
      monthlyClosingReading: monthlyReading
        ? readingProjection(monthlyReading)
        : null,
      knownEndReading: knownEndReading ? readingProjection(knownEndReading) : null,
      hasEstimatedReading: false,
      tenantUsage: null,
      vacantUsage: null,
      sourceReadingIds: [] as string[],
      tenantUsageSegments: emptySegments,
      missingBoundary,
    };
  }

  const knownPhysicalUsage = knownEndReading
    ? knownEndReading.readingValue.minus(startReading.readingValue)
    : null;
  const physicalUsage = attributionEndReading
    ? attributionEndReading.readingValue.minus(startReading.readingValue)
    : null;
  if (
    (knownPhysicalUsage && knownPhysicalUsage.isNegative()) ||
    (physicalUsage && physicalUsage.isNegative())
  ) {
    return {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      installedAt: meter.installedAt,
      removedAt: meter.removedAt,
      complete: false,
      reason: "Readings decrease inside this physical meter segment.",
      invalidChronology: true,
      isClosingComplete: Boolean(monthlyReading),
      physicalUsage: null,
      knownPhysicalUsage: null,
      openingReading: readingProjection(startReading),
      closingReading: attributionEndReading
        ? readingProjection(attributionEndReading)
        : null,
      monthlyClosingReading: monthlyReading
        ? readingProjection(monthlyReading)
        : null,
      knownEndReading: knownEndReading ? readingProjection(knownEndReading) : null,
      hasEstimatedReading: Boolean(
        startReading.source === "ESTIMATED" ||
          knownEndReading?.source === "ESTIMATED",
      ),
      tenantUsage: null,
      vacantUsage: null,
      sourceReadingIds: [
        startReading.id,
        ...(attributionEndReading ? [attributionEndReading.id] : []),
      ],
      tenantUsageSegments: emptySegments,
      missingBoundary,
    };
  }

  if (!attributionEndReading) {
    const active = activeTenancyAt(relevantTenancies, startReading.readingDate);
    return {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      installedAt: meter.installedAt,
      removedAt: meter.removedAt,
      complete: false,
      reason: "No usage reading is available for this physical meter segment.",
      invalidChronology: false,
      isClosingComplete: Boolean(monthlyReading),
      physicalUsage: null,
      knownPhysicalUsage: null,
      openingReading: readingProjection(startReading),
      closingReading: null,
      monthlyClosingReading: monthlyReading
        ? readingProjection(monthlyReading)
        : null,
      knownEndReading: null,
      hasEstimatedReading: startReading.source === "ESTIMATED",
      tenantUsage: null,
      vacantUsage: null,
      sourceReadingIds: [startReading.id],
      tenantUsageSegments: [
        {
          kind: active ? "TENANT" : "VACANT",
          tenancyId: active?.id ?? null,
          label: active ? tenancyName(active) : "Vacant",
          usage: "0",
          startDate: startReading.readingDate,
          endDate: end,
          usageKnown: false,
          isOpen: true,
        },
      ],
      missingBoundary,
    };
  }

  if (missingBoundary.length) {
    const active = activeTenancyAt(relevantTenancies, startReading.readingDate);
    return {
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      installedAt: meter.installedAt,
      removedAt: meter.removedAt,
      complete: false,
      isClosingComplete: Boolean(monthlyReading),
      reason: missingBoundary[0].message,
      invalidChronology: false,
      physicalUsage: physicalUsage ? decimal(physicalUsage) : null,
      knownPhysicalUsage: knownPhysicalUsage
        ? decimal(knownPhysicalUsage)
        : null,
      openingReading: readingProjection(startReading),
      closingReading: readingProjection(attributionEndReading),
      monthlyClosingReading: monthlyReading
        ? readingProjection(monthlyReading)
        : null,
      knownEndReading: knownEndReading ? readingProjection(knownEndReading) : null,
      hasEstimatedReading:
        startReading.source === "ESTIMATED" ||
        attributionEndReading.source === "ESTIMATED",
      tenantUsage: null,
      vacantUsage: null,
      sourceReadingIds: [startReading.id, attributionEndReading.id],
      tenantUsageSegments: [
        {
          kind: active ? "TENANT" : "VACANT",
          tenancyId: active?.id ?? null,
          label: active ? tenancyName(active) : "Vacant",
          usage: "0",
          startDate: startReading.readingDate,
          endDate: attributionEndReading.readingDate,
          usageKnown: false,
          isOpen: true,
        },
      ],
      missingBoundary,
    };
  }

  const boundaryReadings = readings.filter(
    (reading) =>
      (reading.readingType === "MOVE_IN" ||
        reading.readingType === "MOVE_OUT") &&
      reading.readingDate >= segmentStart &&
      reading.readingDate <= attributionEndReading.readingDate &&
      reading.id !== startReading.id &&
      reading.id !== attributionEndReading.id,
  );
  const timeline = [startReading, ...boundaryReadings, attributionEndReading]
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
        invalidChronology: true,
        physicalUsage: null,
        knownPhysicalUsage: null,
        openingReading: readingProjection(startReading),
        closingReading: readingProjection(attributionEndReading),
        monthlyClosingReading: monthlyReading
          ? readingProjection(monthlyReading)
          : null,
        knownEndReading: knownEndReading
          ? readingProjection(knownEndReading)
          : null,
        hasEstimatedReading: timeline.some(
          (reading) => reading.source === "ESTIMATED",
        ),
        tenantUsage: null,
        vacantUsage: null,
        sourceReadingIds: timeline.map((reading) => reading.id),
        tenantUsageSegments: emptySegments,
        isClosingComplete: Boolean(monthlyReading),
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
  if (!billingEndReading && attributionEndReading.readingDate < end) {
    usageSegments.push({
      kind: active ? "TENANT" : "VACANT",
      tenancyId: active?.id ?? null,
      label: active ? tenancyName(active) : "Vacant",
      usage: new Prisma.Decimal(0),
      startDate: attributionEndReading.readingDate,
      endDate: end,
      usageKnown: false,
      isOpen: true,
    });
  }
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
    complete: Boolean(billingEndReading),
    isClosingComplete: Boolean(monthlyReading),
    reason: billingEndReading
      ? null
      : "Monthly closing is not assigned; usage is known so far.",
    invalidChronology: false,
    physicalUsage: physicalUsage ? decimal(physicalUsage) : "0",
    knownPhysicalUsage: knownPhysicalUsage
      ? decimal(knownPhysicalUsage)
      : physicalUsage
        ? decimal(physicalUsage)
        : null,
    openingReading: readingProjection(startReading),
    closingReading: readingProjection(attributionEndReading),
    monthlyClosingReading: monthlyReading
      ? readingProjection(monthlyReading)
      : null,
    knownEndReading: knownEndReading ? readingProjection(knownEndReading) : null,
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
      floor: { select: { name: true } },
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
  const monthComplete = new Date().getTime() >= end.getTime();
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
    const closingRequired = isMonthlyClosingRequired({
      billingMonth: start,
      hasMeter: Boolean(activeMeter),
      tenancies: space.tenancies,
    });
    const isVacantEntireMonth = !space.tenancies.some(
      (tenancy) =>
        tenancy.moveInDate < end &&
        (!tenancy.moveOutDate || tenancy.moveOutDate > start),
    );
    const selectedMonthLockEvidence = space.meters
      .flatMap((meter) => meter.readings)
      .flatMap((reading) => reading.invoiceEvidence)
      .find((evidence) => sameDay(monthStart(evidence.invoice.billingPeriod), start));

    const monthlyReading = activeMeter?.readings.find((reading) =>
      reading.monthlyClosings.some((closing) =>
        sameDay(closing.billingMonth, start),
      ),
    );
    const previousClosingAssignment = activeMeter?.readings
      .flatMap((reading) =>
        reading.monthlyClosings.map((closing) => ({
          billingMonth: closing.billingMonth,
          reading,
        })),
      )
      .filter((closing) => closing.billingMonth < start)
      .sort(
        (left, right) =>
          right.billingMonth.getTime() - left.billingMonth.getTime(),
      )[0];
    const previousClosingReading = previousClosingAssignment?.reading;

    const closingCandidate = activeMeter
      ? resolveMonthlyClosingCandidate({
          billingMonth: start,
          meterInstalledAt: activeMeter.installedAt,
          meterRemovedAt: activeMeter.removedAt,
          readings: activeMeter.readings.map((reading) => ({
            id: reading.id,
            readingDate: reading.readingDate,
            billingMonth: reading.billingMonth,
            readingType: reading.readingType,
            closingMonths: reading.monthlyClosings.map(
              (closing) => closing.billingMonth,
            ),
            locked: reading.invoiceEvidence.length > 0,
          })),
          closings: activeMeter.readings.flatMap((reading) =>
            reading.monthlyClosings.map((closing) => ({
              billingMonth: closing.billingMonth,
              readingId: reading.id,
              readingDate: reading.readingDate,
            })),
          ),
        })
      : null;
    const resolvedClosingCandidateReading = activeMeter?.readings.find(
      (reading) => reading.id === closingCandidate?.id,
    );
    const closingCandidateReading =
      resolvedClosingCandidateReading &&
      (!monthlyReading ||
        resolvedClosingCandidateReading.readingDate > monthlyReading.readingDate)
        ? resolvedClosingCandidateReading
        : undefined;

    const selectedMonthReading = activeMeter?.readings
      .filter(
        (reading) =>
          reading.billingMonth !== null &&
          sameDay(monthStart(reading.billingMonth), start),
      )
      .at(-1);
    const selectedWindowEnd =
      monthlyReading && monthlyReading.readingDate > end
        ? monthlyReading.readingDate
        : end;
    const latestReading =
      selectedMonthReading ??
      activeMeter?.readings
        .filter((reading) => reading.readingDate <= selectedWindowEnd)
        .at(-1);

    const meterSegments = space.meters.map((meter) =>
      computePhysicalMeterSegment(meter, space.tenancies, start, end),
    );
    const knownUsage = meterSegments.reduce(
      (sum, segment) => sum.plus(segment.knownPhysicalUsage ?? 0),
      new Prisma.Decimal(0),
    );
    const hasKnownUsage = meterSegments.some(
      (segment) => segment.knownPhysicalUsage !== null,
    );
    const closingUsage = meterSegments.reduce(
      (sum, segment) => sum.plus(segment.physicalUsage ?? 0),
      new Prisma.Decimal(0),
    );
    const hasClosingUsage =
      Boolean(monthlyReading) &&
      meterSegments.length > 0 &&
      meterSegments.every((segment) => segment.physicalUsage !== null);

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
        !segment.isOpen &&
        previous.endDate.getTime() === segment.startDate.getTime()
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

    const closingQuality = monthlyReading
      ? resolveClosingDateQuality(start, monthlyReading.readingDate)
      : null;
    const earlyClosing = Boolean(
      monthlyReading && closingQuality?.kind === "EARLY" && !monthComplete,
    );
    const closingReady = !activeMeter
      ? false
      : !closingRequired
        ? true
        : Boolean(monthlyReading) && monthComplete;
    const closingState = !activeMeter
      ? ("N/A" as const)
      : selectedMonthLockEvidence
        ? ("LOCKED" as const)
        : monthlyReading
          ? ("CLOSING_SET" as const)
          : closingRequired
            ? ("OPEN" as const)
            : ("OPTIONAL" as const);
    const closingStatus = !activeMeter
      ? ("NO_METER" as const)
      : closingState === "LOCKED"
        ? ("LOCKED" as const)
        : closingState === "CLOSING_SET"
          ? ("CLOSING_SET" as const)
          : closingState === "OPEN"
            ? ("NEEDS_CLOSING" as const)
            : ("OPTIONAL" as const);

    const invalidChronology = meterSegments.some(
      (segment) => segment.invalidChronology,
    );
    const hasOpenTenantSegment = tenancySegments.some(
      (segment) => segment.kind === "TENANT" && segment.isOpen,
    );
    const missingRequiredOpening = meterSegments.some(
      (segment) =>
        segment.reason?.startsWith("Missing opening") && !isVacantEntireMonth,
    );
    const attributionReady = Boolean(
      activeMeter &&
        missingBoundary.length === 0 &&
        !invalidChronology &&
        !missingRequiredOpening &&
        !hasOpenTenantSegment &&
        (!closingRequired || closingReady || isVacantEntireMonth),
    );

    const warnings: string[] = [];
    for (const segment of meterSegments) {
      if (segment.invalidChronology && segment.reason) {
        warnings.push(segment.reason);
      } else if (
        segment.reason?.startsWith("Missing opening") &&
        !isVacantEntireMonth
      ) {
        warnings.push(segment.reason);
      }
      warnings.push(...segment.missingBoundary.map((boundary) => boundary.message));
    }
    if (monthlyReading?.source === "ESTIMATED") {
      warnings.push("Monthly closing reading is estimated.");
    }
    if (activeMeter && closingRequired && !monthlyReading) {
      warnings.push("Monthly closing is required for this room.");
    }
    if (closingQuality?.warning && closingQuality.kind !== "EARLY") {
      warnings.push(closingQuality.warning);
    }
    if (earlyClosing) {
      warnings.push(
        "Recorded before the month ended. You can replace it with a later reading.",
      );
    }
    if (!monthComplete) {
      warnings.push("The month isn't over yet.",);
    }

    return {
      spaceId: space.id,
      room: space.name,
      floorName: space.floor.name,
      activeMeter: activeMeter
        ? {
            id: activeMeter.id,
            meterNumber: activeMeter.meterNumber,
            installedAt: activeMeter.installedAt,
            latestReading: latestReading ? readingProjection(latestReading) : null,
          }
        : null,
      meterId: activeMeter?.id ?? null,
      meterNumber: activeMeter?.meterNumber ?? null,
      previousClosingReading: previousClosingReading
        ? readingProjection(previousClosingReading)
        : null,
      previousReading: previousClosingReading
        ? readingProjection(previousClosingReading)
        : null,
      monthlyReading: monthlyReading ? readingProjection(monthlyReading) : null,
      closingCandidate: closingCandidateReading
        ? readingProjection(closingCandidateReading)
        : null,
      currentReading: closingCandidateReading
        ? readingProjection(closingCandidateReading)
        : null,
      latestReading: latestReading ? readingProjection(latestReading) : null,
      previous: previousClosingReading
        ? decimal(previousClosingReading.readingValue)
        : null,
      current: monthlyReading ? decimal(monthlyReading.readingValue) : null,
      readingDate: monthlyReading?.readingDate ?? null,
      source: monthlyReading?.source ?? "MEASURED",
      billingMonth: start,
      actualReadingDate: monthlyReading?.readingDate ?? null,
      closingDateOffsetDays: closingQuality?.offsetDays ?? null,
      closingDateQuality: closingQuality?.kind ?? null,
      lateReadingDays:
        closingQuality && closingQuality.offsetDays > 0
          ? closingQuality.offsetDays
          : 0,
      earlyClosing,
      closingRequired,
      closingReady,
      closingState,
      closingStatus,
      closingLocked: closingState === "LOCKED",
      lockInvoice: selectedMonthLockEvidence?.invoice ?? null,
      isVacantEntireMonth,
      meterReplacementDuringMonth: space.meters.length > 1,
      activeMeterIsNewThisMonth: Boolean(
        activeMeter && activeMeter.installedAt >= start && activeMeter.installedAt < end,
      ),
      manualReadingMinDate: activeMeter
        ? [
            activeMeter.installedAt,
            previousClosingReading?.readingDate,
            monthlyReading?.readingDate,
          ]
            .filter((value): value is Date => Boolean(value))
            .sort((left, right) => right.getTime() - left.getTime())[0]
        : null,
      knownUsageMeterCount: meterSegments.filter(
        (segment) => segment.knownPhysicalUsage !== null,
      ).length,
      monthlyPhysicalUsage: hasClosingUsage ? decimal(closingUsage) : null,
      knownPhysicalUsage: hasKnownUsage ? decimal(knownUsage) : null,
      isClosingComplete: closingReady,
      readingStatus: closingStatus,
      attributionStatus: attributionReady
        ? ("COMPLETE" as const)
        : ("PARTIAL" as const),
      monthlyCycleStatus: closingStatus,
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
      estimatedAttributableUsage: null,
      estimatedPhysicalUsage: null,
      estimatedVacantUsage: null,
      calculatedAmount: null,
      finalAmount: null,
      estimatedCalculatedAmount: null,
      estimatedFinalAmount: null,
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
      estimatedAttributableUsage: null,
      estimatedPhysicalUsage: null,
      estimatedVacantUsage: null,
      calculatedAmount: null,
      finalAmount: null,
      estimatedCalculatedAmount: null,
      estimatedFinalAmount: null,
    };
  }
  const complete =
    entry.attributionStatus === "COMPLETE" && entry.closingReady;

  // Preview/estimate values are intentionally independent from billing readiness.
  // Known closed segments can be priced while the room is still incomplete, but
  // final billing fields below remain null until attribution/closing is complete.
  const knownTenantSegments = entry.tenancySegments.filter(
    (segment) => segment.kind === "TENANT" && segment.usageKnown,
  );
  const knownVacantSegments = entry.tenancySegments.filter(
    (segment) => segment.kind === "VACANT" && segment.usageKnown,
  );
  const knownTenantUsage = knownTenantSegments.reduce(
    (sum, segment) => sum.plus(segment.usage),
    new Prisma.Decimal(0),
  );
  const knownVacantUsage = knownVacantSegments.reduce(
    (sum, segment) => sum.plus(segment.usage),
    new Prisma.Decimal(0),
  );
  const hasKnownTenantUsage = knownTenantSegments.length > 0;

  const tenantUsage = complete ? knownTenantUsage : null;
  const physicalUsage = complete
    ? new Prisma.Decimal(
        entry.monthlyPhysicalUsage ?? entry.knownPhysicalUsage ?? 0,
      )
    : null;
  const vacantUsage = complete ? knownVacantUsage : null;
  const override = await overrideAt(spaceId, "ELECTRICITY", start);
  const applicable = override
    ? { rate: override.rate }
    : await rateAt(property.floor.propertyId, "ELECTRICITY", start);
  const reason = !complete
    ? (entry.warnings[0] ??
      (entry.closingRequired && !entry.closingReady
        ? "Monthly closing is not ready for billing."
        : "Electricity attribution is incomplete."))
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
        usageKnown: segment.usageKnown,
        isOpen: segment.isOpen,
        share:
          segment.usageKnown && hasKnownTenantUsage && !knownTenantUsage.isZero()
            ? new Prisma.Decimal(segment.usage)
                .div(knownTenantUsage)
                .mul(100)
                .toFixed(1)
            : "0",
        amount:
          segment.usageKnown && applicable
            ? decimal(new Prisma.Decimal(segment.usage).mul(applicable.rate))
            : null,
        startDate: segment.startDate,
        endDate: segment.endDate,
      })),
    totalAttributableUsage: tenantUsage ? decimal(tenantUsage) : null,
    totalPhysicalUsage: physicalUsage ? decimal(physicalUsage) : null,
    vacantUsage: vacantUsage ? decimal(vacantUsage) : null,
    estimatedAttributableUsage: hasKnownTenantUsage
      ? decimal(knownTenantUsage)
      : null,
    estimatedPhysicalUsage: entry.knownPhysicalUsage,
    estimatedVacantUsage: knownVacantSegments.length
      ? decimal(knownVacantUsage)
      : null,
    applicableRate: applicable ? decimal(applicable.rate) : null,
    rateOverridden: Boolean(override),
    overrideReason: override?.reason ?? null,
    closingStatus: entry.closingStatus,
    closingRequired: entry.closingRequired,
    closingReading: entry.monthlyReading,
    knownPhysicalUsage: entry.knownPhysicalUsage,
    calculatedAmount:
      tenantUsage && applicable
        ? decimal(tenantUsage.mul(applicable.rate))
        : null,
    finalAmount:
      tenantUsage && applicable
        ? decimal(roundVnd(tenantUsage.mul(applicable.rate)))
        : null,
    estimatedCalculatedAmount:
      hasKnownTenantUsage && applicable
        ? decimal(knownTenantUsage.mul(applicable.rate))
        : null,
    estimatedFinalAmount:
      hasKnownTenantUsage && applicable
        ? decimal(roundVnd(knownTenantUsage.mul(applicable.rate)))
        : null,
  };
}

export async function getWaterPreview(
  propertyId: string,
  month: string | Date,
) {
  const start = monthStart(date(month));
  const end = monthEndExclusive(start);
  const [rate, occupants, activeOverrides] = await Promise.all([
    rateAt(propertyId, "WATER", start),
    prisma.tenancyOccupant.findMany({
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
          select: {
            id: true,
            spaceId: true,
            space: { select: { name: true } },
          },
        },
      },
    }),
    prisma.utilityRateOverride.findMany({
      where: {
        utilityType: "WATER",
        effectiveFrom: { lte: start },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: start } }],
        space: { floor: { propertyId } },
      },
      orderBy: { effectiveFrom: "desc" },
      select: {
        spaceId: true,
        rate: true,
        reason: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    }),
  ]);

  const overrideBySpace = new Map<
    string,
    (typeof activeOverrides)[number]
  >();
  for (const override of activeOverrides) {
    if (!overrideBySpace.has(override.spaceId)) {
      overrideBySpace.set(override.spaceId, override);
    }
  }

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
    const override = overrideBySpace.get(occupant.tenancy.spaceId);
    const applicableRate = override?.rate ?? rate?.rate ?? null;
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
      applicableRate: applicableRate ? decimal(applicableRate) : null,
      rateOverridden: Boolean(override),
      overrideReason: override?.reason ?? null,
      amount: applicableRate
        ? decimal(
            fullMonth
              ? applicableRate
              : applicableRate.div(30).mul(billableDays),
          )
        : null,
    };
  });

  const amount = (items: typeof details) => {
    if (!items.length) return rate ? "0" : null;
    if (items.some((item) => item.amount === null)) return null;
    return decimal(
      items.reduce(
        (sum, item) => sum.plus(item.amount ?? 0),
        new Prisma.Decimal(0),
      ),
    );
  };

  const roomSummaries = [...new Set(details.map((item) => item.spaceId))].map(
    (spaceId) => {
      const roomDetails = details.filter((item) => item.spaceId === spaceId);
      const override = overrideBySpace.get(spaceId);
      const applicableRate = override?.rate ?? rate?.rate ?? null;
      const calculatedPreviewAmount = amount(roomDetails);
      return {
        spaceId,
        room: roomDetails[0]?.room ?? "Room",
        billablePeople: roomDetails.length,
        occupantDays: roomDetails.reduce(
          (sum, item) => sum + item.billableDays,
          0,
        ),
        occupants: roomDetails,
        applicableRate: applicableRate ? decimal(applicableRate) : null,
        rateOverridden: Boolean(override),
        overrideReason: override?.reason ?? null,
        calculatedPreviewAmount,
        finalPreviewAmount:
          calculatedPreviewAmount !== null
            ? decimal(roundVnd(new Prisma.Decimal(calculatedPreviewAmount)))
            : null,
      };
    },
  );

  const calculatedPreviewAmount = amount(details);
  return {
    applicableRate: rate ? decimal(rate.rate) : null,
    billablePeople: details.length,
    occupantDays: details.reduce((sum, item) => sum + item.billableDays, 0),
    occupants: details,
    roomSummaries,
    calculatedPreviewAmount,
    finalPreviewAmount:
      calculatedPreviewAmount !== null
        ? decimal(roundVnd(new Prisma.Decimal(calculatedPreviewAmount)))
        : null,
  };
}

export async function getRates(propertyId: string) {
  const rates = await prisma.utilityRate.findMany({
    where: { propertyId },
    orderBy: [{ utilityType: "asc" }, { effectiveFrom: "desc" }],
  });
  const overrides = await prisma.utilityRateOverride.findMany({
    where: { space: { floor: { propertyId } } },
    include: { space: { select: { name: true } } },
    orderBy: [
      { effectiveFrom: "desc" },
      { utilityType: "asc" },
      { space: { name: "asc" } },
    ],
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
      applicableRate: water.applicableRate,
      rateOverridden: false,
      overrideReason: null,
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
  const monthlyClosingsRequired = entries.filter(
    (entry) => entry.activeMeter && entry.closingRequired,
  ).length;
  const monthlyClosingsRecorded = entries.filter(
    (entry) => entry.closingRequired && entry.monthlyReading,
  ).length;
  const monthlyClosingsOptional = entries.filter(
    (entry) => entry.activeMeter && !entry.closingRequired,
  ).length;
  return {
    electricity,
    monthlyClosingsRecorded,
    monthlyClosingsRequired,
    monthlyClosingsOptional,
    monthlyClosingsNeedsClosing: entries.filter(
      (entry) => entry.closingStatus === "NEEDS_CLOSING",
    ).length,
    monthlyClosingsSet: entries.filter(
      (entry) =>
        entry.closingStatus === "CLOSING_SET" || entry.closingStatus === "LOCKED",
    ).length,
    monthlyClosingsLocked: entries.filter(
      (entry) => entry.closingStatus === "LOCKED",
    ).length,
    monthlyReadingsRecorded: monthlyClosingsRecorded,
    monthlyReadingsRequired: monthlyClosingsRequired,
    attributionReady: entries.filter(
      (entry) => entry.activeMeter && entry.attributionStatus === "COMPLETE",
    ).length,
    attributionRequired: entries.filter((entry) => entry.activeMeter).length,
    warnings,
    water,
  };
}
