import { TenancyDomainError } from "./errors";
import type { NormalizedMoveInInput, NormalizedMoveInOccupant } from "./types";

const before = (left: Date, right: Date) => left.getTime() < right.getTime();
const sameDate = (left: Date, right: Date) =>
  left.getTime() === right.getTime();

export function periodsOverlap(
  firstStart: Date,
  firstEnd: Date | null,
  secondStart: Date,
  secondEnd: Date | null,
) {
  return (
    (secondEnd === null || before(firstStart, secondEnd)) &&
    (firstEnd === null || before(secondStart, firstEnd))
  );
}

export function isActiveOnDate(
  startDate: Date,
  endDate: Date | null,
  businessDate: Date,
) {
  return (
    !before(businessDate, startDate) &&
    (endDate === null || before(businessDate, endDate))
  );
}

function assertMembershipPeriod(
  occupant: NormalizedMoveInOccupant,
  tenancyStart: Date,
  tenancyEnd: Date | null,
) {
  if (occupant.endDate && !before(occupant.startDate, occupant.endDate)) {
    throw new TenancyDomainError(
      "INVALID_MEMBERSHIP_DATES",
      "Occupant end date must be after the start date.",
    );
  }
  if (before(occupant.startDate, tenancyStart)) {
    throw new TenancyDomainError(
      "INVALID_MEMBERSHIP_DATES",
      "Occupant participation cannot begin before the tenancy.",
    );
  }
  if (
    tenancyEnd &&
    (!before(occupant.startDate, tenancyEnd) ||
      occupant.endDate === null ||
      before(tenancyEnd, occupant.endDate))
  ) {
    throw new TenancyDomainError(
      "INVALID_MEMBERSHIP_DATES",
      "Occupant participation must remain inside the tenancy period.",
    );
  }
}

export function assertMoveInRules(input: NormalizedMoveInInput) {
  if (input.moveOutDate && !before(input.moveInDate, input.moveOutDate)) {
    throw new TenancyDomainError(
      "INVALID_TENANCY_DATES",
      "Move-out date must be after move-in date.",
    );
  }
  if (
    input.monthlyRentVnd < BigInt(0) ||
    (input.depositVnd !== null && input.depositVnd < BigInt(0))
  ) {
    throw new TenancyDomainError(
      "INVALID_MONEY",
      "Rent and deposit cannot be negative.",
    );
  }

  const seen = new Set<string>();
  for (const occupant of input.occupants) {
    if (seen.has(occupant.personId)) {
      throw new TenancyDomainError(
        "DUPLICATE_OCCUPANT",
        "A person can appear only once in the initial occupant list.",
      );
    }
    seen.add(occupant.personId);
    assertMembershipPeriod(occupant, input.moveInDate, input.moveOutDate);
  }

  const responsible = input.occupants.filter(
    (occupant) => occupant.role === "RESPONSIBLE",
  );
  if (responsible.length !== 1) {
    throw new TenancyDomainError(
      "INVALID_RESPONSIBLE_CONFIGURATION",
      "A tenancy must begin with exactly one responsible person.",
    );
  }
  if (!sameDate(responsible[0].startDate, input.moveInDate)) {
    throw new TenancyDomainError(
      "INVALID_RESPONSIBLE_CONFIGURATION",
      "The responsible person must start on the move-in date.",
    );
  }
}

export function assertMoveOutRules(
  moveInDate: Date,
  moveOutDate: Date,
  occupantStartDates: Date[],
) {
  if (!before(moveInDate, moveOutDate)) {
    throw new TenancyDomainError(
      "INVALID_TENANCY_DATES",
      "Move-out date must be after move-in date.",
    );
  }
  if (occupantStartDates.some((startDate) => !before(startDate, moveOutDate))) {
    throw new TenancyDomainError(
      "INVALID_MEMBERSHIP_DATES",
      "Move-out date must be after every occupant start date.",
    );
  }
}
