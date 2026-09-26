import { describe, expect, it } from "vitest";

import { normalizeCitizenId, normalizeVietnamesePhone } from "./identity";
import { createPersonSchema } from "./validation";

describe("person identity validation", () => {
  it("trims the required name and accepts omitted optional fields", () => {
    expect(createPersonSchema.parse({ fullName: "  Test Person  " })).toEqual({
      fullName: "Test Person",
    });
    expect(createPersonSchema.safeParse({ fullName: " " }).success).toBe(false);
  });

  it("normalizes practical Vietnamese phone formats", () => {
    expect(normalizeVietnamesePhone("090 123 4567")).toBe("+84901234567");
    expect(normalizeVietnamesePhone("84-901-234-567")).toBe("+84901234567");
    expect(normalizeVietnamesePhone("+84 (901) 234 567")).toBe("+84901234567");
    expect(
      createPersonSchema.safeParse({ fullName: "Test", phone: "123" }).success,
    ).toBe(false);
  });

  it("accepts 12-digit CCCD and 9-digit legacy CMND values", () => {
    expect(normalizeCitizenId("012 345 678 901")).toBe("012345678901");
    expect(normalizeCitizenId("123-456-789")).toBe("123456789");
  });

  it("rejects invalid citizen IDs", () => {
    for (const citizenId of ["12345678", "1234567890", "12345678901x"]) {
      expect(
        createPersonSchema.safeParse({ fullName: "Test", citizenId }).success,
      ).toBe(false);
    }
  });
});
