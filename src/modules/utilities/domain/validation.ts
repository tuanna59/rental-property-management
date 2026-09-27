import { z } from "zod";
import { normalizeBusinessDate } from "@/modules/tenancy/domain/validation";

const decimal = z
  .union([
    z.number().nonnegative(),
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/),
  ])
  .transform(String);

const businessMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Billing month must use YYYY-MM format.")
  .transform((value, context) => {
    const date = new Date(`${value}-01T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 7) !== value
    ) {
      context.addIssue({
        code: "custom",
        message: "Billing month is invalid.",
      });

      return z.NEVER;
    }

    return date;
  });
export function date(value: string | Date) {
  return normalizeBusinessDate(value);
}
export function month(value: unknown) {
  return businessMonthSchema.parse(value);
}
export function reading(value: string | number) {
  return decimal.parse(value);
}
export function requiredText(value: string, message: string) {
  if (!value.trim()) throw new Error(message);
  return value.trim();
}
