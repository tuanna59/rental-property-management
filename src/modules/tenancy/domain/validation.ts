import { z } from "zod";

import { TenancyDomainError } from "./errors";
import type {
  MoveInInput,
  MoveOutInput,
  NormalizedMoveInInput,
  NormalizedMoveOutInput,
} from "./types";

const idSchema = z.string().trim().min(1);
const optionalTextSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(1000).optional(),
);
const businessDateSchema = z
  .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .transform((value, context) => {
    const text =
      value instanceof Date ? value.toISOString().slice(0, 10) : value;
    const date = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== text
    ) {
      context.addIssue({
        code: "custom",
        message: "Business date is invalid.",
      });
      return z.NEVER;
    }
    return date;
  });
const optionalBusinessDateSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  businessDateSchema.optional(),
);
const vndSchema = z
  .union([
    z.bigint(),
    z.number().int().safe(),
    z
      .string()
      .trim()
      .regex(/^-?\d+$/),
  ])
  .transform((value) => BigInt(value));
const optionalVndSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  vndSchema.optional(),
);

const moveInSchema = z.object({
  spaceId: idSchema,
  moveInDate: businessDateSchema,
  moveOutDate: optionalBusinessDateSchema,
  monthlyRentVnd: vndSchema,
  depositVnd: optionalVndSchema,
  moveInNotes: optionalTextSchema,
  electricityReading: z.union([z.string(), z.number()]).nullable().optional(),
  electricityPhoto: z.instanceof(File).optional(),
  occupants: z.array(
    z.object({
      personId: idSchema,
      role: z.enum(["RESPONSIBLE", "ADDITIONAL"]),
      startDate: businessDateSchema,
      endDate: optionalBusinessDateSchema,
      notes: optionalTextSchema,
    }),
  ),
});

const moveOutSchema = z.object({
  tenancyId: idSchema,
  moveOutDate: businessDateSchema,
  moveOutNotes: optionalTextSchema,
  electricityReading: z.union([z.string(), z.number()]).nullable().optional(),
  electricityPhoto: z.instanceof(File).optional(),
  electricityReadingSource: z.enum(["MEASURED", "ESTIMATED"]).optional(),
  electricityReadingReason: optionalTextSchema,
});

function invalidMoveInInput(error: z.ZodError): never {
  const root = error.issues[0]?.path[0];
  if (root === "monthlyRentVnd" || root === "depositVnd") {
    throw new TenancyDomainError(
      "INVALID_MONEY",
      "Rent and deposit must be whole VND amounts.",
    );
  }
  if (root === "occupants") {
    throw new TenancyDomainError(
      "INVALID_MEMBERSHIP_DATES",
      "Occupant information is invalid.",
    );
  }
  throw new TenancyDomainError(
    "INVALID_TENANCY_DATES",
    "Tenancy information is invalid.",
  );
}

export function normalizeMoveInInput(
  input: MoveInInput,
): NormalizedMoveInInput {
  const parsed = moveInSchema.safeParse(input);
  if (!parsed.success) invalidMoveInInput(parsed.error);
  return {
    ...parsed.data,
    moveOutDate: parsed.data.moveOutDate ?? null,
    depositVnd: parsed.data.depositVnd ?? null,
    occupants: parsed.data.occupants.map((occupant) => ({
      ...occupant,
      endDate: occupant.endDate ?? null,
    })),
  };
}

export function normalizeMoveOutInput(
  input: MoveOutInput,
): NormalizedMoveOutInput {
  const parsed = moveOutSchema.safeParse(input);
  if (!parsed.success) {
    throw new TenancyDomainError(
      "INVALID_TENANCY_DATES",
      "Move-out information is invalid.",
    );
  }
  return parsed.data;
}

export function normalizeBusinessDate(value: string | Date) {
  const parsed = businessDateSchema.safeParse(value);
  if (!parsed.success) {
    throw new TenancyDomainError(
      "INVALID_TENANCY_DATES",
      "Business date is invalid.",
    );
  }
  return parsed.data;
}
