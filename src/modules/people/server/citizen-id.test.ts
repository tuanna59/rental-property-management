import { describe, expect, it } from "vitest";

import {
  citizenIdLookupHash,
  decryptCitizenId,
  encryptCitizenId,
  protectCitizenId,
  type CitizenIdSecrets,
} from "./citizen-id";

const secrets: CitizenIdSecrets = {
  encryptionKey: Buffer.alloc(32, 17),
  lookupHmacKey: Buffer.alloc(32, 29),
};

describe("citizen ID protection", () => {
  it("round trips authenticated encryption without embedding plaintext", () => {
    const citizenId = "012345678901";
    const encrypted = encryptCitizenId(citizenId, secrets);
    expect(encrypted).not.toContain(citizenId);
    expect(decryptCitizenId(encrypted, secrets)).toBe(citizenId);
    expect(encryptCitizenId(citizenId, secrets)).not.toBe(encrypted);
  });

  it("supports legacy nine-digit CMND values", () => {
    const protectedValue = protectCitizenId("123 456 789", secrets);
    expect(decryptCitizenId(protectedValue.citizenIdEncrypted, secrets)).toBe(
      "123456789",
    );
    expect(protectedValue.citizenIdLast4).toBe("6789");
  });

  it("uses a deterministic keyed lookup hash", () => {
    expect(citizenIdLookupHash("012345678901", secrets)).toBe(
      citizenIdLookupHash("012 345 678 901", secrets),
    );
    expect(citizenIdLookupHash("012345678901", secrets)).not.toBe(
      citizenIdLookupHash("012345678902", secrets),
    );
  });

  it("rejects tampered encrypted values", () => {
    const encrypted = encryptCitizenId("012345678901", secrets);
    expect(() => decryptCitizenId(`${encrypted}x`, secrets)).toThrow(
      "could not be decrypted",
    );
  });
});
