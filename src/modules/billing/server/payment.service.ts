import { Prisma } from "@/generated/prisma/client";
import { positiveWholeVnd } from "@/lib/money";
import { date } from "@/modules/utilities/domain/validation";
import { tenancyTransaction } from "@/modules/tenancy/server/transaction";
import { calculateInvoiceFinancials } from "../domain/invoice-financials";

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
      include: { lines: true, adjustments: true, payments: true },
    });
    if (!invoice || invoice.status !== "FINALIZED")
      throw new Error("Only finalized invoices can receive payments.");
    const financials = calculateInvoiceFinancials({
      lineAmounts: invoice.lines.map((line) => line.finalAmount),
      adjustments: invoice.adjustments,
      payments: invoice.payments,
    });
    if (amount.greaterThan(new Prisma.Decimal(financials.outstanding)))
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
      include: {
        invoice: {
          include: { lines: true, adjustments: true, payments: true },
        },
      },
    });
    if (!existing || existing.invoice.status !== "FINALIZED")
      throw new Error("Payment was not found.");
    const financials = calculateInvoiceFinancials({
      lineAmounts: existing.invoice.lines.map((line) => line.finalAmount),
      adjustments: existing.invoice.adjustments,
      payments: existing.invoice.payments.filter((payment) => payment.id !== paymentId),
    });
    if (amount.greaterThan(new Prisma.Decimal(financials.outstanding)))
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
