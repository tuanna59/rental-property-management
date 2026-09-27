import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  monthEndExclusive,
  monthStart,
} from "@/modules/utilities/domain/rules";
import { date } from "@/modules/utilities/domain/validation";
import { getInvoices } from "./billing.queries";

export async function getPayments(propertyId: string, month?: string | Date) {
  const start = month ? monthStart(date(month)) : null;
  const end = start ? monthEndExclusive(start) : null;
  const payments = await prisma.payment.findMany({
    where: {
      ...(start && end ? { paymentDate: { gte: start, lt: end } } : {}),
      invoice: { tenancy: { space: { floor: { propertyId } } } },
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    include: {
      invoice: {
        include: {
          lines: { select: { finalAmount: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  });
  return payments.map((payment) => {
    const total = payment.invoice.lines.reduce(
      (sum, line) => sum.plus(line.finalAmount),
      new Prisma.Decimal(0),
    );
    const paid = payment.invoice.payments.reduce(
      (sum, item) => sum.plus(item.amount),
      new Prisma.Decimal(0),
    );
    const balance = total.minus(paid);
    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      invoiceLabel: `INV-${payment.invoiceId.slice(-6).toUpperCase()}`,
      amount: payment.amount.toString(),
      paymentDate: payment.paymentDate,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      isDepositApplication: payment.isDepositApplication,
      billingPeriod: payment.invoice.billingPeriod,
      room: payment.invoice.roomNameSnapshot,
      renterName: payment.invoice.renterNameSnapshot,
      invoiceTotal: total.toString(),
      totalPaid: paid.toString(),
      balance: balance.toString(),
      paymentStatus: paid.isZero()
        ? ("UNPAID" as const)
        : balance.isZero()
          ? ("PAID" as const)
          : ("PARTIAL" as const),
    };
  });
}

export async function getFinancialSummary(
  propertyId: string,
  month: string | Date,
) {
  const start = monthStart(date(month));
  const end = monthEndExclusive(start);
  const [invoices, collected] = await Promise.all([
    getInvoices(propertyId, start),
    prisma.payment.aggregate({
      where: {
        paymentDate: { gte: start, lt: end },
        isDepositApplication: false,
        invoice: { tenancy: { space: { floor: { propertyId } } } },
      },
      _sum: { amount: true },
    }),
  ]);
  const finalized = invoices.filter(
    (invoice) => invoice.status === "FINALIZED",
  );
  const billed = finalized.reduce(
    (sum, invoice) => sum.plus(invoice.total),
    new Prisma.Decimal(0),
  );
  const outstanding = finalized.reduce(
    (sum, invoice) => sum.plus(invoice.balance),
    new Prisma.Decimal(0),
  );
  return {
    billed: billed.toString(),
    collected: collected._sum.amount?.toString() ?? "0",
    outstanding: outstanding.toString(),
    paid: finalized.filter((invoice) => invoice.paymentStatus === "PAID")
      .length,
    partial: finalized.filter((invoice) => invoice.paymentStatus === "PARTIAL")
      .length,
    unpaid: finalized.filter((invoice) => invoice.paymentStatus === "UNPAID")
      .length,
  };
}
