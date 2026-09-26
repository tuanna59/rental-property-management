import { describe, expect, it } from "vitest";

import { projectRentalState } from "./rental-state";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const period = (start: string, end: string | null) => ({
  startDate: day(start),
  endDate: end ? day(end) : null,
  moveInDate: day(start),
  moveOutDate: end ? day(end) : null,
});

describe("rental state projection", () => {
  it("uses half-open boundaries for current and former", () => {
    expect(
      projectRentalState(
        [period("2026-09-01", "2026-10-01")],
        day("2026-09-30"),
      ).state,
    ).toBe("CURRENT");
    expect(
      projectRentalState(
        [period("2026-09-01", "2026-10-01")],
        day("2026-10-01"),
      ).state,
    ).toBe("FORMER");
  });

  it("distinguishes upcoming from former and never rented", () => {
    expect(
      projectRentalState([period("2026-10-01", null)], day("2026-09-25")).state,
    ).toBe("UPCOMING");
    expect(projectRentalState([], day("2026-09-25")).state).toBe("NO_RENTAL");
  });
});
