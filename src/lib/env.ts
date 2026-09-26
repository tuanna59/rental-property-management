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

const citizenIdEnvironmentSchema = z.object({
  PERSON_CITIZEN_ID_ENCRYPTION_KEY: z.string().min(1),
  PERSON_CITIZEN_ID_LOOKUP_HMAC_KEY: z.string().min(1),
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

function decodeBase64Secret(value: string, expectedLength?: number) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error("Citizen ID protection keys are not configured correctly.");
  }

  const decoded = Buffer.from(value, "base64");
  if (
    decoded.toString("base64") !== value ||
    decoded.length < 32 ||
    (expectedLength !== undefined && decoded.length !== expectedLength)
  ) {
    throw new Error("Citizen ID protection keys are not configured correctly.");
  }
  return decoded;
}

export function readCitizenIdEnvironment(
  source: Record<string, string | undefined> = process.env,
) {
  const result = citizenIdEnvironmentSchema.safeParse(source);
  if (!result.success) {
    throw new Error("Citizen ID protection keys are not configured correctly.");
  }

  const encryptionKey = decodeBase64Secret(
    result.data.PERSON_CITIZEN_ID_ENCRYPTION_KEY,
    32,
  );
  const lookupHmacKey = decodeBase64Secret(
    result.data.PERSON_CITIZEN_ID_LOOKUP_HMAC_KEY,
  );
  if (encryptionKey.equals(lookupHmacKey)) {
    throw new Error("Citizen ID protection keys must be independent.");
  }

  return { encryptionKey, lookupHmacKey };
}
