import { expect, it } from "vitest";
import { readEnvironment } from "./env";
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
