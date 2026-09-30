import { monthEndExclusive, monthStart } from "./rules";

type ClosingCandidateReading = {
  id: string;
  readingDate: Date;
  billingMonth: Date | null;
  readingType: string;
  closingMonths: Date[];
  locked: boolean;
};

type MonthlyClosing = {
  billingMonth: Date;
  readingId: string;
  readingDate: Date;
};

type TenancyWindow = {
  moveInDate: Date;
  moveOutDate: Date | null;
};

export type ClosingDateQuality =
  | { kind: "EARLY"; offsetDays: number; warning: string }
  | { kind: "ON_TIME"; offsetDays: 0; warning: null }
  | { kind: "LATE"; offsetDays: number; warning: string }
  | { kind: "VERY_LATE"; offsetDays: number; warning: string };

const DAY = 86_400_000;

function inferredBillingMonth(readingDate: Date) {
  const currentMonth = monthStart(readingDate);
  const previousMonth = new Date(
    Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1),
  );
  const previousExpected = new Date(currentMonth.getTime() - DAY);
  const currentExpected = new Date(
    monthEndExclusive(currentMonth).getTime() - DAY,
  );
  const previousDistance = Math.abs(
    readingDate.getTime() - previousExpected.getTime(),
  );
  const currentDistance = Math.abs(
    readingDate.getTime() - currentExpected.getTime(),
  );

  return previousDistance < currentDistance ? previousMonth : currentMonth;
}

export function isMonthlyClosingRequired(input: {
  billingMonth: Date;
  hasMeter: boolean;
  tenancies: TenancyWindow[];
}) {
  if (!input.hasMeter) return false;
  const cycleStart = monthStart(input.billingMonth);
  const cycleEnd = monthEndExclusive(cycleStart);

  return input.tenancies.some(
    (tenancy) =>
      tenancy.moveInDate < cycleEnd &&
      (!tenancy.moveOutDate || tenancy.moveOutDate >= cycleEnd),
  );
}

export function resolveClosingDateQuality(
  billingMonth: Date,
  readingDate: Date,
): ClosingDateQuality {
  const cycleStart = monthStart(billingMonth);
  const cycleEnd = monthEndExclusive(cycleStart);
  const expectedDate = new Date(cycleEnd.getTime() - DAY);
  const offsetDays = Math.round(
    (readingDate.getTime() - expectedDate.getTime()) / DAY,
  );

  if (offsetDays < 0) {
    return {
      kind: "EARLY",
      offsetDays,
      warning: `This reading was taken ${Math.abs(offsetDays)} day${Math.abs(offsetDays) === 1 ? "" : "s"} before the month ended.`,
    };
  }
  if (offsetDays === 0) {
    return { kind: "ON_TIME", offsetDays: 0, warning: null };
  }
  if (offsetDays > 7) {
    return {
      kind: "VERY_LATE",
      offsetDays,
      warning: `This reading was taken ${offsetDays} days after the month ended and may include later consumption.`,
    };
  }
  return {
    kind: "LATE",
    offsetDays,
    warning: `This reading was taken ${offsetDays} day${offsetDays === 1 ? "" : "s"} after the month ended.`,
  };
}

export function resolveMonthlyClosingCandidate(input: {
  billingMonth: Date;
  meterInstalledAt: Date;
  meterRemovedAt: Date | null;
  readings: ClosingCandidateReading[];
  closings: MonthlyClosing[];
}) {
  const cycleStart = monthStart(input.billingMonth);
  const cycleEnd = monthEndExclusive(cycleStart);
  if (
    input.meterInstalledAt >= cycleEnd ||
    (input.meterRemovedAt && input.meterRemovedAt <= cycleStart)
  ) {
    return null;
  }

  const previousClosing = input.closings
    .filter((closing) => closing.billingMonth < cycleStart)
    .sort(
      (left, right) =>
        right.billingMonth.getTime() - left.billingMonth.getTime(),
    )[0];
  const laterClosing = input.closings
    .filter((closing) => closing.billingMonth > cycleStart)
    .sort(
      (left, right) =>
        left.billingMonth.getTime() - right.billingMonth.getTime(),
    )[0];
  const anchorDate = previousClosing?.readingDate ?? input.meterInstalledAt;

  const eligible = input.readings
    .filter((reading) => {
      const ownerMonth = reading.billingMonth
        ? monthStart(reading.billingMonth)
        : inferredBillingMonth(reading.readingDate);
      return (
        reading.readingType === "MANUAL" &&
        !reading.locked &&
        reading.closingMonths.length === 0 &&
        ownerMonth.getTime() === cycleStart.getTime() &&
        reading.readingDate >= anchorDate &&
        reading.readingDate >= cycleStart &&
        (!laterClosing || reading.readingDate < laterClosing.readingDate)
      );
    })
    .sort(
      (left, right) => left.readingDate.getTime() - right.readingDate.getTime(),
    );

  const expectedDate = new Date(cycleEnd.getTime() - DAY);
  return (
    eligible
      .sort((left, right) => {
        const leftDistance = Math.abs(
          left.readingDate.getTime() - expectedDate.getTime(),
        );
        const rightDistance = Math.abs(
          right.readingDate.getTime() - expectedDate.getTime(),
        );
        return (
          leftDistance - rightDistance ||
          right.readingDate.getTime() - left.readingDate.getTime()
        );
      })[0] ?? null
  );
}
