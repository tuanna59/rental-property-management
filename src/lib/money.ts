import { Prisma } from "@/generated/prisma/client";

export function roundVnd(value: Prisma.Decimal | string | number | bigint) {
  const amount = new Prisma.Decimal(value.toString());
  return amount.plus(250).div(500).floor().mul(500);
}

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
