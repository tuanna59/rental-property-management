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
export function date(value: string | Date) {
  return normalizeBusinessDate(value);
}
export function reading(value: string | number) {
  return decimal.parse(value);
}
export function requiredText(value: string, message: string) {
  if (!value.trim()) throw new Error(message);
  return value.trim();
}
