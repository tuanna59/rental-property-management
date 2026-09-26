import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required.");
const auditUrl = new URL(source);
if (!["localhost", "127.0.0.1", "[::1]"].includes(auditUrl.hostname)) {
  throw new Error("Integration tests require a local database.");
}
auditUrl.pathname = "/rental_house_phase01_audit_v2";
process.env.DATABASE_URL = auditUrl.toString();
process.env.PERSON_CITIZEN_ID_ENCRYPTION_KEY = Buffer.alloc(32, 41).toString(
  "base64",
);
process.env.PERSON_CITIZEN_ID_LOOKUP_HMAC_KEY = Buffer.alloc(32, 73).toString(
  "base64",
);
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
