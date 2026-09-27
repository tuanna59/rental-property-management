import { Prisma } from "@/generated/prisma/client";
import { positiveWholeVnd } from "@/lib/money";
import { date } from "@/modules/utilities/domain/validation";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";

type PaymentInput = {
  invoiceId: string;
  amount: string;
  paymentDate: string;
  method: "CASH" | "BANK_TRANSFER" | "OTHER";
  reference?: string;
  notes?: string;
};

export async function recordPayment(input: PaymentInput) {
  const amount = positiveWholeVnd(input.amount);
  return tenancyTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { lines: true, payments: true },
    });
    if (!invoice || invoice.status !== "FINALIZED")
      throw new Error("Only finalized invoices can receive payments.");
    const total = invoice.lines.reduce(
      (sum, line) => sum.plus(line.finalAmount),
      new Prisma.Decimal(0),
    );
    const paid = invoice.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    if (amount.greaterThan(total.minus(paid)))
      throw new Error("Payment cannot exceed the remaining balance.");
    return tx.payment.create({
      data: {
        invoiceId: input.invoiceId,
        amount,
        paymentDate: date(input.paymentDate),
        method: input.method,
        reference: input.reference || null,
        notes: input.notes || null,
      },
    });
  });
}

export async function updatePayment(
  paymentId: string,
  input: Omit<PaymentInput, "invoiceId">,
) {
  const amount = positiveWholeVnd(input.amount);
  return tenancyTransaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { include: { lines: true, payments: true } } },
    });
    if (!existing || existing.invoice.status !== "FINALIZED")
      throw new Error("Payment was not found.");
    const total = existing.invoice.lines.reduce(
      (sum, line) => sum.plus(line.finalAmount),
      new Prisma.Decimal(0),
    );
    const otherPaid = existing.invoice.payments
      .filter((payment) => payment.id !== paymentId)
      .reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
    if (amount.greaterThan(total.minus(otherPaid)))
      throw new Error("Payment cannot exceed the remaining balance.");
    return tx.payment.update({
      where: { id: paymentId },
      data: {
        amount,
        paymentDate: date(input.paymentDate),
        method: input.method,
        reference: input.reference || null,
        notes: input.notes || null,
      },
    });
  });
}
