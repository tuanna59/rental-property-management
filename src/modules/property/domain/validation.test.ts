import { describe, expect, it } from "vitest";

import {
  createFloorSchema,
  createSpaceSchema,
  updatePropertySchema,
} from "./validation";

describe("property validation", () => {
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
