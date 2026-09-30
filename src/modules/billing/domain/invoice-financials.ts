export type MoneyValue = string | bigint | { toString(): string };

export type InvoiceAdjustmentFinancialInput = {
  type: string;
  amount: MoneyValue;
};

export type InvoicePaymentFinancialInput = {
  amount: MoneyValue;
};

export type InvoicePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

function moneyBigInt(value: MoneyValue): bigint {
  const raw = typeof value === "bigint" ? value.toString() : value.toString();
  const normalized = raw.trim();
  const match = /^(-?\d+)(?:\.0+)?$/.exec(normalized);
  if (!match) {
    throw new Error(`Expected a whole-VND amount, received: ${normalized}`);
  }
  return BigInt(match[1]);
}

function sumMoney(values: MoneyValue[]): bigint {
  return values.reduce<bigint>(
    (sum, value) => sum + moneyBigInt(value),
    BigInt(0),
  );
}

export function calculateInvoiceFinancials(input: {
  lineAmounts: MoneyValue[];
  adjustments?: InvoiceAdjustmentFinancialInput[];
  payments?: InvoicePaymentFinancialInput[];
}) {
  const originalTotal = sumMoney(input.lineAmounts);
  let creditTotal = BigInt(0);
  let debitTotal = BigInt(0);

  for (const adjustment of input.adjustments ?? []) {
    const amount = moneyBigInt(adjustment.amount);
    if (adjustment.type === "CREDIT") creditTotal += amount;
    else if (adjustment.type === "DEBIT" || adjustment.type === "CHARGE") {
      // CHARGE is accepted only as a migration/backward-compatibility alias.
      debitTotal += amount;
    }
  }

  const adjustmentNet = debitTotal - creditTotal;
  const effectiveTotal = originalTotal + adjustmentNet;
  const paidAmount = sumMoney((input.payments ?? []).map((payment) => payment.amount));
  const rawOutstanding = effectiveTotal - paidAmount;
  const outstanding = rawOutstanding > BigInt(0) ? rawOutstanding : BigInt(0);
  const maximumCredit = effectiveTotal > paidAmount
    ? effectiveTotal - paidAmount
    : BigInt(0);

  let paymentStatus: InvoicePaymentStatus;
  if (paidAmount === BigInt(0)) paymentStatus = "UNPAID";
  else if (paidAmount >= effectiveTotal) paymentStatus = "PAID";
  else paymentStatus = "PARTIAL";

  return {
    originalTotal: originalTotal.toString(),
    creditTotal: creditTotal.toString(),
    debitTotal: debitTotal.toString(),
    adjustmentNet: adjustmentNet.toString(),
    effectiveTotal: effectiveTotal.toString(),
    paidAmount: paidAmount.toString(),
    outstanding: outstanding.toString(),
    maximumCredit: maximumCredit.toString(),
    paymentStatus,
  };
}
