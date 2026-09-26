import { expect, it } from "vitest";
import { readCitizenIdEnvironment, readEnvironment } from "./env";
it("requires PostgreSQL URLs without leaking credentials in errors", () => {
  expect(() => readEnvironment({})).toThrow("DATABASE_URL");
  expect(() =>
    readEnvironment({ DATABASE_URL: "https://secret:password@example.com" }),
  ).toThrow("DATABASE_URL must be a valid PostgreSQL connection URL.");
  expect(
    readEnvironment({ DATABASE_URL: "postgresql://user:password@localhost/db" })
      .DATABASE_URL,
  ).toContain("postgresql:");
});

it("requires independent base64 citizen ID keys without leaking values", () => {
  const encryption = Buffer.alloc(32, 1).toString("base64");
  const lookup = Buffer.alloc(32, 2).toString("base64");
  expect(
    readCitizenIdEnvironment({
      PERSON_CITIZEN_ID_ENCRYPTION_KEY: encryption,
      PERSON_CITIZEN_ID_LOOKUP_HMAC_KEY: lookup,
    }).encryptionKey,
  ).toHaveLength(32);
  expect(() =>
    readCitizenIdEnvironment({
      PERSON_CITIZEN_ID_ENCRYPTION_KEY: encryption,
      PERSON_CITIZEN_ID_LOOKUP_HMAC_KEY: encryption,
    }),
  ).toThrow("independent");
  expect(() =>
    readCitizenIdEnvironment({
      PERSON_CITIZEN_ID_ENCRYPTION_KEY: "not-a-key",
      PERSON_CITIZEN_ID_LOOKUP_HMAC_KEY: lookup,
    }),
  ).toThrow("not configured correctly");
});
