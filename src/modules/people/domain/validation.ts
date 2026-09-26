import { z } from "zod";

import { normalizeCitizenId, normalizeVietnamesePhone } from "./identity";

const idSchema = z.string().trim().min(1, "Missing identifier.");
const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required.")
  .max(120, "Full name must be 120 characters or fewer.");
const optionalTextSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(1000, "Text must be 1000 characters or fewer.")
    .optional(),
);

const optionalPhoneSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(40, "Phone must be 40 characters or fewer.")
    .superRefine((value, context) => {
      try {
        normalizeVietnamesePhone(value);
      } catch {
        context.addIssue({
          code: "custom",
          message: "Enter a valid Vietnamese phone number.",
        });
      }
    })
    .optional(),
);

const optionalCitizenIdSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .superRefine((value, context) => {
      try {
        normalizeCitizenId(value);
      } catch {
        context.addIssue({
          code: "custom",
          message: "Citizen ID must contain 12 CCCD or 9 CMND digits.",
        });
      }
    })
    .transform(normalizeCitizenId)
    .optional(),
);

const optionalDateOnlySchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z
    .union([
      z.date(),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
        .transform((value, context) => {
          const date = new Date(`${value}T00:00:00.000Z`);
          if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== value
          ) {
            context.addIssue({ code: "custom", message: "Date is invalid." });
            return z.NEVER;
          }
          return date;
        }),
    ])
    .refine((date) => date <= new Date(), "Date of birth cannot be future.")
    .optional(),
);

const personFields = {
  fullName: fullNameSchema,
  phone: optionalPhoneSchema,
  dateOfBirth: optionalDateOnlySchema,
  citizenId: optionalCitizenIdSchema,
  notes: optionalTextSchema,
};

export const createPersonSchema = z.object(personFields);

export const updatePersonSchema = z.object({
  personId: idSchema,
  ...personFields,
});

export const archivePersonSchema = z.object({ personId: idSchema });
export const restorePersonSchema = archivePersonSchema;
