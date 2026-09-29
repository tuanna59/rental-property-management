import { z } from "zod";

import type { getActionFeedback } from "@/i18n/action-feedback";

import { PeopleDomainError } from "./domain/identity";
import { createPersonSchema } from "./domain/validation";

export type TenantsFeedback = Awaited<ReturnType<typeof getActionFeedback>>;

const PERSON_VALIDATION_KEYS: Record<string, string> = {
  "Missing identifier.": "validationMissingIdentifier",
  "Full name is required.": "validationFullNameRequired",
  "Full name must be 120 characters or fewer.": "validationFullNameTooLong",
  "Text must be 1000 characters or fewer.": "validationTextTooLong",
  "Phone must be 40 characters or fewer.": "validationPhoneTooLong",
  "Enter a valid Vietnamese phone number.": "validationPhone",
  "Citizen ID must contain 12 CCCD or 9 CMND digits.": "validationCitizenId",
  "Use YYYY-MM-DD format.": "validationDateFormat",
  "Date is invalid.": "validationDateInvalid",
  "Date of birth cannot be future.": "validationDateFuture",
};

const PEOPLE_DOMAIN_KEYS: Record<string, string> = {
  "Citizen ID must be a 12-digit CCCD or 9-digit legacy CMND.":
    "validationCitizenId",
  "Phone must be a Vietnamese number using 0, 84, or +84 format.":
    "validationPhone",
  "Citizen ID storage is not configured. Leave it blank or configure the protection keys.":
    "errorCitizenIdStorage",
  "A person with this citizen ID already exists.": "errorCitizenIdExists",
  "The selected person was not found.": "errorPersonNotFound",
  "Current or upcoming renters cannot be archived. End or cancel their occupancy first.":
    "errorArchiveActivePerson",
  "Citizen ID data could not be decrypted.": "errorCitizenIdDecrypt",
};

export function localizePersonFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
  feedback: TenantsFeedback,
) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      messages?.map((message) => {
        const key = PERSON_VALIDATION_KEYS[message];
        return key ? feedback(key) : message;
      }),
    ]),
  );
}

export function localizePeopleDomainError(
  error: PeopleDomainError,
  feedback: TenantsFeedback,
) {
  const key = PEOPLE_DOMAIN_KEYS[error.message];
  return key ? feedback(key) : feedback("personSaveFailed");
}

export function localizePersonValidationError(
  error: z.ZodError,
  feedback: TenantsFeedback,
) {
  const message = error.issues[0]?.message;
  const key = message ? PERSON_VALIDATION_KEYS[message] : undefined;
  return key ? feedback(key) : feedback("checkFields");
}

export function parseNewPersonForAction(
  input: { fullName: string; phone?: string; citizenId?: string },
  feedback: TenantsFeedback,
) {
  const parsed = createPersonSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: localizePersonValidationError(parsed.error, feedback),
    };
  }
  return { ok: true as const, data: parsed.data };
}
