import { describe, expect, it } from "vitest";

import { TenancyDomainError } from "./errors";
import {
  assertMoveInRules,
  assertMoveOutRules,
  isActiveOnDate,
  periodsOverlap,
} from "./rules";
import { normalizeMoveInInput } from "./validation";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function validMoveIn() {
  return normalizeMoveInInput({
    spaceId: "room-1",
    moveInDate: "2026-09-01",
    moveOutDate: "2026-10-01",
    monthlyRentVnd: "3500000",
    depositVnd: 7_000_000,
    occupants: [
      {
        personId: "person-1",
        role: "RESPONSIBLE",
        startDate: "2026-09-01",
        endDate: "2026-10-01",
      },
    ],
  });
}

function expectCode(work: () => unknown, code: TenancyDomainError["code"]) {
  try {
    work();
    throw new Error("Expected a tenancy domain error.");
  } catch (error) {
    expect(error).toBeInstanceOf(TenancyDomainError);
    expect((error as TenancyDomainError).code).toBe(code);
  }
}

describe("tenancy period rules", () => {
  it("uses half-open overlap and active-date boundaries", () => {
    expect(
      periodsOverlap(
        day("2026-09-01"),
        day("2026-10-01"),
        day("2026-10-01"),
        day("2026-11-01"),
      ),
    ).toBe(false);
    expect(
      periodsOverlap(
        day("2026-09-01"),
        day("2026-10-01"),
        day("2026-09-30"),
        null,
      ),
    ).toBe(true);
    expect(
      isActiveOnDate(day("2026-09-01"), day("2026-10-01"), day("2026-09-01")),
    ).toBe(true);
    expect(
      isActiveOnDate(day("2026-09-01"), day("2026-10-01"), day("2026-10-01")),
    ).toBe(false);
  });

  it("accepts a valid initial occupant set", () => {
    expect(() => assertMoveInRules(validMoveIn())).not.toThrow();
  });

  it("rejects invalid tenancy dates and money", () => {
    const reversed = validMoveIn();
    reversed.moveOutDate = reversed.moveInDate;
    expectCode(() => assertMoveInRules(reversed), "INVALID_TENANCY_DATES");

    const negative = validMoveIn();
    negative.monthlyRentVnd = BigInt(-1);
    expectCode(() => assertMoveInRules(negative), "INVALID_MONEY");
  });

  it("rejects duplicate people and invalid responsible configurations", () => {
    const duplicate = validMoveIn();
    duplicate.occupants.push({
      ...duplicate.occupants[0],
      role: "ADDITIONAL",
    });
    expectCode(() => assertMoveInRules(duplicate), "DUPLICATE_OCCUPANT");

    const noResponsible = validMoveIn();
    noResponsible.occupants[0].role = "ADDITIONAL";
    expectCode(
      () => assertMoveInRules(noResponsible),
      "INVALID_RESPONSIBLE_CONFIGURATION",
    );

    const lateResponsible = validMoveIn();
    lateResponsible.occupants[0].startDate = day("2026-09-02");
    expectCode(
      () => assertMoveInRules(lateResponsible),
      "INVALID_RESPONSIBLE_CONFIGURATION",
    );
  });

  it("keeps occupant membership inside the tenancy", () => {
    const beforeTenancy = validMoveIn();
    beforeTenancy.occupants[0].startDate = day("2026-08-31");
    expectCode(
      () => assertMoveInRules(beforeTenancy),
      "INVALID_MEMBERSHIP_DATES",
    );

    const afterTenancy = validMoveIn();
    afterTenancy.occupants[0].endDate = null;
    expectCode(
      () => assertMoveInRules(afterTenancy),
      "INVALID_MEMBERSHIP_DATES",
    );
  });

  it("requires move-out after tenancy and occupant starts", () => {
    expect(() =>
      assertMoveOutRules(day("2026-09-01"), day("2026-10-01"), [
        day("2026-09-01"),
        day("2026-09-15"),
      ]),
    ).not.toThrow();
    expectCode(
      () => assertMoveOutRules(day("2026-09-01"), day("2026-09-01"), []),
      "INVALID_TENANCY_DATES",
    );
    expectCode(
      () =>
        assertMoveOutRules(day("2026-09-01"), day("2026-09-15"), [
          day("2026-09-15"),
        ]),
      "INVALID_MEMBERSHIP_DATES",
    );
  });
});
