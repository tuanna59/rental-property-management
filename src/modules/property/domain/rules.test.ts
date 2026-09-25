import { describe, expect, it } from "vitest";

import {
  DomainError,
  assertCanArchiveFloor,
  assertCanDeleteFloor,
  assertSpaceBelongsToFloor,
  moveOrderedId,
  nextSortOrder,
} from "./rules";

describe("property domain rules", () => {
  it("assigns the next sort order after the current maximum", () => {
    expect(
      nextSortOrder([
        { id: "a", sortOrder: 1 },
        { id: "b", sortOrder: 4 },
      ]),
    ).toBe(5);
  });

  it("moves an item up or down without changing other ids", () => {
    expect(
      moveOrderedId(["floor-1", "floor-2", "floor-3"], "floor-2", "up"),
    ).toEqual(["floor-2", "floor-1", "floor-3"]);
    expect(moveOrderedId(["p01", "p02", "p03"], "p02", "down")).toEqual([
      "p01",
      "p03",
      "p02",
    ]);
  });

  it("keeps boundary reorder attempts stable", () => {
    expect(moveOrderedId(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveOrderedId(["a", "b"], "b", "down")).toEqual(["a", "b"]);
  });

  it("rejects reorder attempts for missing records", () => {
    expect(() => moveOrderedId(["a", "b"], "c", "up")).toThrow(DomainError);
  });

  it("prevents archiving a floor with active spaces", () => {
    expect(() => assertCanArchiveFloor(1)).toThrow(
      "Archive or move spaces before archiving this floor.",
    );
  });

  it("allows deleting only floors without spaces", () => {
    expect(() => assertCanDeleteFloor(2)).toThrow(
      "Delete is only allowed for floors with no spaces.",
    );
    expect(() => assertCanDeleteFloor(0)).not.toThrow();
  });

  it("guards invalid space/floor relationships", () => {
    expect(() => assertSpaceBelongsToFloor("floor-a", "floor-b")).toThrow(
      "The selected space does not belong to this floor.",
    );
  });
});
