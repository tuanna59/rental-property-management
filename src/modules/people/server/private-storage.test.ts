import { describe, expect, it } from "vitest";

import {
  createPersonMediaKey,
  mediaContentType,
  validatePrivateImage,
} from "./private-storage";

describe("private person image storage", () => {
  it("creates opaque keys without identity data", () => {
    const key = createPersonMediaKey("person_123", "citizen-front", "jpg");
    expect(key).toMatch(/^people\/person_123\/citizen-front\/[0-9a-f-]+\.jpg$/);
    expect(key).not.toContain("Nguyen");
    expect(mediaContentType(key)).toBe("image/jpeg");
  });

  it("accepts matching image bytes and rejects spoofed MIME types", async () => {
    const jpeg = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      "ignored-name.jpg",
      { type: "image/jpeg" },
    );
    await expect(validatePrivateImage(jpeg)).resolves.toMatchObject({
      mime: "image/jpeg",
      extension: "jpg",
    });
    const spoofed = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      "image.png",
      { type: "image/png" },
    );
    await expect(validatePrivateImage(spoofed)).rejects.toThrow(
      "valid JPEG, PNG, or WebP",
    );
  });

  it("rejects unsafe person identifiers", () => {
    expect(() => createPersonMediaKey("../outside", "avatar", "jpg")).toThrow(
      "Invalid private media destination",
    );
  });
});
