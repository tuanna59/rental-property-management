import "dotenv/config";

export function auditDatabaseUrl() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const url = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Audit database must be local.");
  url.pathname = "/rental_house_phase01_audit_v2";
  return url.toString();
}
