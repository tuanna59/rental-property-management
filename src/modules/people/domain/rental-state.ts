export type RentalState = "CURRENT" | "UPCOMING" | "FORMER" | "NO_RENTAL";

export type RentalPeriod = {
  startDate: Date;
  endDate: Date | null;
  moveInDate: Date;
  moveOutDate: Date | null;
};

const later = (left: Date, right: Date) => (left > right ? left : right);

function effectiveStart(period: RentalPeriod) {
  return later(period.startDate, period.moveInDate);
}

function effectiveEnd(period: RentalPeriod) {
  if (!period.endDate) return period.moveOutDate;
  if (!period.moveOutDate) return period.endDate;
  return period.endDate < period.moveOutDate
    ? period.endDate
    : period.moveOutDate;
}

export function projectRentalState<TPeriod extends RentalPeriod>(
  periods: TPeriod[],
  date: Date,
) {
  const current = periods.find((period) => {
    const start = effectiveStart(period);
    const end = effectiveEnd(period);
    return start <= date && (!end || end > date);
  });
  if (current) return { state: "CURRENT" as const, current, upcoming: null };

  const upcoming = periods
    .filter((period) => effectiveStart(period) > date)
    .sort(
      (left, right) =>
        effectiveStart(left).getTime() - effectiveStart(right).getTime(),
    )[0];
  if (upcoming) return { state: "UPCOMING" as const, current: null, upcoming };

  return {
    state: periods.length ? ("FORMER" as const) : ("NO_RENTAL" as const),
    current: null,
    upcoming: null,
  };
}
