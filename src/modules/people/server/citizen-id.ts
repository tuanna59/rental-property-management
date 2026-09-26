import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

import { readCitizenIdEnvironment } from "@/lib/env";

import {
  citizenIdLast4,
  normalizeCitizenId,
  PeopleDomainError,
} from "../domain/identity";

const algorithm = "aes-256-gcm";
const envelopeVersion = "v1";
const additionalData = Buffer.from("rental-house:person-citizen-id:v1");

export type CitizenIdSecrets = {
  encryptionKey: Buffer;
  lookupHmacKey: Buffer;
};

function resolvedSecrets(secrets?: CitizenIdSecrets) {
  const resolved = secrets ?? readCitizenIdEnvironment();
  if (
    resolved.encryptionKey.length !== 32 ||
    resolved.lookupHmacKey.length < 32 ||
    resolved.encryptionKey.equals(resolved.lookupHmacKey)
  ) {
    throw new Error("Citizen ID protection keys are not configured correctly.");
  }
  return resolved;
}

function decodeEnvelopePart(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PeopleDomainError("Citizen ID data could not be decrypted.");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new PeopleDomainError("Citizen ID data could not be decrypted.");
  }
  return decoded;
}

export function encryptCitizenId(value: string, secrets?: CitizenIdSecrets) {
  const normalized = normalizeCitizenId(value);
  const { encryptionKey } = resolvedSecrets(secrets);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey, iv);
  cipher.setAAD(additionalData);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [envelopeVersion, iv, tag, ciphertext]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(".");
}

export function decryptCitizenId(envelope: string, secrets?: CitizenIdSecrets) {
  const { encryptionKey } = resolvedSecrets(secrets);
  const [version, ivValue, tagValue, ciphertextValue, extra] =
    envelope.split(".");
  if (
    version !== envelopeVersion ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new PeopleDomainError("Citizen ID data could not be decrypted.");
  }

  try {
    const iv = decodeEnvelopePart(ivValue);
    const tag = decodeEnvelopePart(tagValue);
    const ciphertext = decodeEnvelopePart(ciphertextValue);
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new PeopleDomainError("Citizen ID data could not be decrypted.");
    }
    const decipher = createDecipheriv(algorithm, encryptionKey, iv);
    decipher.setAAD(additionalData);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    return normalizeCitizenId(plaintext);
  } catch {
    throw new PeopleDomainError("Citizen ID data could not be decrypted.");
  }
}

export function citizenIdLookupHash(value: string, secrets?: CitizenIdSecrets) {
  const normalized = normalizeCitizenId(value);
  const { lookupHmacKey } = resolvedSecrets(secrets);
  return createHmac("sha256", lookupHmacKey)
    .update(normalized, "utf8")
    .digest("hex");
}

export function protectCitizenId(value: string, secrets?: CitizenIdSecrets) {
  const normalized = normalizeCitizenId(value);
  return {
    citizenIdEncrypted: encryptCitizenId(normalized, secrets),
    citizenIdLookupHash: citizenIdLookupHash(normalized, secrets),
    citizenIdLast4: citizenIdLast4(normalized),
  };
}
