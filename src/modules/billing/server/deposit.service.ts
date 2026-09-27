import { Prisma } from "@/generated/prisma/client";
import { positiveWholeVnd } from "@/lib/money";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";
import { date } from "@/modules/utilities/domain/validation";

type BaseInput = {
  tenancyId: string;
  amount: string;
  transactionDate: string;
  reference?: string;
  notes?: string;
};

async function heldBalance(tx: Prisma.TransactionClient, tenancyId: string) {
  const items = await tx.depositTransaction.findMany({
    where: { tenancyId },
    select: { type: true, amount: true },
  });
  return items.reduce(
    (held, item) =>
      item.type === "RECEIPT"
        ? held.plus(item.amount)
        : held.minus(item.amount),
    new Prisma.Decimal(0),
  );
}

export async function recordDepositReceipt(input: BaseInput) {
  return tenancyTransaction((tx) =>
    tx.depositTransaction.create({
      data: {
        tenancyId: input.tenancyId,
        type: "RECEIPT",
        amount: positiveWholeVnd(input.amount),
        transactionDate: date(input.transactionDate),
        reference: input.reference || null,
        notes: input.notes || null,
      },
    }),
  );
}

export async function addDepositDeduction(
  input: BaseInput & {
    category: "DAMAGE" | "CLEANING" | "OUTSTANDING_INVOICE" | "OTHER";
  },
) {
  const amount = positiveWholeVnd(input.amount);
  return tenancyTransaction(async (tx) => {
    if (amount.greaterThan(await heldBalance(tx, input.tenancyId)))
      throw new Error("Deduction cannot exceed the held deposit.");
    return tx.depositTransaction.create({
      data: {
        tenancyId: input.tenancyId,
        type: "DEDUCTION",
        amount,
        transactionDate: date(input.transactionDate),
        category: input.category,
        reference: input.reference || null,
        notes: input.notes || null,
      },
    });
  });
}

export async function refundDeposit(input: BaseInput) {
  const amount = positiveWholeVnd(input.amount);
  return tenancyTransaction(async (tx) => {
    if (amount.greaterThan(await heldBalance(tx, input.tenancyId)))
      throw new Error("Refund cannot exceed the held deposit.");
    return tx.depositTransaction.create({
      data: {
        tenancyId: input.tenancyId,
        type: "REFUND",
        amount,
        transactionDate: date(input.transactionDate),
        reference: input.reference || null,
        notes: input.notes || null,
      },
    });
  });
}

export async function applyDepositToInvoice(
  input: BaseInput & { invoiceId: string },
) {
  const amount = positiveWholeVnd(input.amount);
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { lines: true, payments: true },
    });
    if (
      !invoice ||
      invoice.status !== "FINALIZED" ||
      invoice.tenancyId !== input.tenancyId
    )
      throw new Error("Choose a finalized invoice for this tenancy.");
    const held = await heldBalance(tx, input.tenancyId);
    const total = invoice.lines.reduce(
      (sum, line) => sum.plus(line.finalAmount),
      new Prisma.Decimal(0),
    );
    const paid = invoice.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    if (amount.greaterThan(held))
      throw new Error("Application cannot exceed the held deposit.");
    if (amount.greaterThan(total.minus(paid)))
      throw new Error("Application cannot exceed the invoice balance.");
    const transaction = await tx.depositTransaction.create({
      data: {
        tenancyId: input.tenancyId,
        type: "APPLIED_TO_INVOICE",
        amount,
        transactionDate: date(input.transactionDate),
        invoiceId: input.invoiceId,
        reference: input.reference || null,
        notes: input.notes || null,
      },
    });
    await tx.payment.create({
      data: {
        invoiceId: input.invoiceId,
        amount,
        paymentDate: date(input.transactionDate),
        method: "OTHER",
        reference: `Deposit application ${transaction.id}`,
        notes: input.notes || null,
        isDepositApplication: true,
      },
    });
    return transaction;
  });
}
