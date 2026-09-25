import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      "A PostgreSQL connection URL is required.",
    ),
});

export function readEnvironment(
  source: Record<string, string | undefined> = process.env,
) {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    // Do not include connection strings or credentials in errors.
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  return result.data;
}
