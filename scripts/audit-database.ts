import "dotenv/config";
import { Client } from "pg";
import { spawnSync } from "node:child_process";
import { auditDatabaseUrl } from "../tests/audit-environment";

async function main() {
  const mode = process.argv[2];
  if (mode === "inspect") {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      const result = await db.query(
        'SELECT f.name AS floor, f."archivedAt" AS floor_archived, s.name, s.type, s."archivedAt" AS space_archived FROM "Floor" f LEFT JOIN "Space" s ON s."floorId"=f.id ORDER BY f."sortOrder", s."sortOrder"',
      );
      console.table(result.rows);
    } finally {
      await db.end();
    }
    return;
  }
  const databaseUrl = auditDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  if (mode === "prepare") {
    const adminUrl = new URL(databaseUrl);
    adminUrl.pathname = "/postgres";
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
      const exists = await admin.query(
        "SELECT 1 FROM pg_database WHERE datname=$1",
        ["rental_house_phase01_audit_v2"],
      );
      if (!exists.rowCount)
        await admin.query("CREATE DATABASE rental_house_phase01_audit_v2");
      console.log(
        exists.rowCount
          ? "Reusing dedicated audit database."
          : "Created fresh dedicated audit database.",
      );
    } finally {
      await admin.end();
    }
    for (const args of [["db:migrate"], ["db:seed"]]) {
      const result = spawnSync("pnpm", args, {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: process.env,
      });
      if (result.status !== 0) throw new Error(args.join(" ") + " failed");
    }
    const db = new Client({ connectionString: databaseUrl });
    await db.connect();
    try {
      const { rows } = await db.query(
        'SELECT s.name FROM "Space" s JOIN "Floor" f ON f.id=s."floorId" WHERE s.type=\'ROOM\' AND s."archivedAt" IS NULL AND f."archivedAt" IS NULL ORDER BY s.name',
      );
      const actual = rows.map((row) => row.name);
      const expected = Array.from(
        { length: 8 },
        (_, i) => "P" + String(i + 1).padStart(2, "0"),
      );
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(
          "Fresh seed does not contain exactly P01-P08: " + actual.join(", "),
        );
      console.log("FRESH SEED PASS: exactly " + actual.join(", "));
    } finally {
      await db.end();
    }
  } else if (mode === "serve") {
    const result = spawnSync("pnpm", ["dev", "--port", "3001"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    process.exitCode = result.status ?? 1;
  } else throw new Error("Expected inspect, prepare, or serve.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
