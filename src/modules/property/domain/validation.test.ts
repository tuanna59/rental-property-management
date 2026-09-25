import { describe, expect, it } from "vitest";

import {
  createFloorSchema,
  createSpaceSchema,
  updatePropertySchema,
  updateFloorSchema,
  updateSpaceSchema,
  reorderFloorSchema,
} from "./validation";

describe("property validation", () => {
  it("rejects missing identifiers, oversized names, invalid levels and directions", () => {
    expect(
      updatePropertySchema.safeParse({ propertyId: "", name: "Valid" }).success,
    ).toBe(false);
    expect(
      updatePropertySchema.safeParse({ propertyId: "p", name: "a".repeat(121) })
        .success,
    ).toBe(false);
    for (const level of ["no", 1.5, 201, -11]) {
      expect(
        createFloorSchema.safeParse({ propertyId: "p", name: "Floor", level })
          .success,
      ).toBe(false);
    }
    expect(
      reorderFloorSchema.safeParse({
        propertyId: "p",
        floorId: "f",
        direction: "sideways",
      }).success,
    ).toBe(false);
  });
  it("validates updates and normalizes cleared optional fields", () => {
    expect(
      updateFloorSchema.parse({
        floorId: "f",
        name: " Floor ",
        level: "",
        notes: " ",
      }),
    ).toMatchObject({ name: "Floor", level: undefined, notes: undefined });
    expect(
      updateSpaceSchema.safeParse({ spaceId: "s", name: " ", type: "ROOM" })
        .success,
    ).toBe(false);
    expect(
      updateSpaceSchema.parse({
        spaceId: "s",
        name: " Name ",
        type: "ROOFTOP",
        notes: "",
      }),
    ).toMatchObject({ name: "Name", notes: undefined });
  });
  it("accepts basic property updates and trims text fields", () => {
    const result = updatePropertySchema.parse({
      propertyId: "property-1",
      name: "  My Rental Property  ",
      addressLine1: "",
      city: "  Ho Chi Minh City ",
      country: "Vietnam",
      description: "",
    });

    expect(result.name).toBe("My Rental Property");
    expect(result.addressLine1).toBeUndefined();
    expect(result.city).toBe("Ho Chi Minh City");
  });

  it("rejects blank floor names", () => {
    const result = createFloorSchema.safeParse({
      propertyId: "property-1",
      name: " ",
      level: "2",
      notes: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported space types", () => {
    const result = createSpaceSchema.safeParse({
      floorId: "floor-1",
      name: "P09",
      type: "TENANT",
      notes: "",
    });

    expect(result.success).toBe(false);
  });
});
