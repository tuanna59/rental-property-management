import { Prisma } from "@/generated/prisma/client";

export function roundMoneyAmount(
  value: Prisma.Decimal | string | number | bigint,
) {
  const amount = new Prisma.Decimal(value.toString());
  return amount
    .div(10)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .mul(10);
}

export const roundVnd = roundMoneyAmount;

export function positiveWholeVnd(value: string | number | bigint) {
  const amount = new Prisma.Decimal(value.toString());
  if (!amount.isInteger() || !amount.isPositive()) {
    throw new Error("Amount must be a positive whole-VND value.");
  }
  return amount;
}

export function nonNegativeWholeVnd(value: string | number | bigint) {
  const amount = new Prisma.Decimal(value.toString());
  if (!amount.isInteger() || amount.isNegative()) {
    throw new Error("Amount must be a non-negative whole-VND value.");
  }
  return amount;
}
