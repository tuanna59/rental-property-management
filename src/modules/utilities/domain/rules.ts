import { Prisma } from "@/generated/prisma/client";

export function assertReadingDoesNotDecrease(
  previous: Prisma.Decimal | null,
  value: Prisma.Decimal,
) {
  if (previous && value.lessThan(previous))
    throw new Error(
      "A measured reading cannot be lower than the previous reading for this meter.",
    );
}

export function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}
export function monthEndExclusive(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}
