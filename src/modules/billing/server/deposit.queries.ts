import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateInvoiceFinancials } from "../domain/invoice-financials";

export async function getDepositOverview(propertyId: string) {
  const tenancies = await prisma.tenancy.findMany({
    where: {
      space: { floor: { propertyId } },
      OR: [
        { depositVnd: { not: null } },
        { depositTransactions: { some: {} } },
      ],
    },
    orderBy: [{ moveInDate: "desc" }],
    select: {
      id: true,
      depositVnd: true,
      moveOutDate: true,
      space: { select: { name: true } },
      occupants: {
        where: { role: "RESPONSIBLE" },
        orderBy: { startDate: "asc" },
        take: 1,
        select: { person: { select: { fullName: true } } },
      },
      depositTransactions: {
        orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
      },
      invoices: {
        where: { status: "FINALIZED" },
        include: { lines: true, adjustments: true, payments: true },
        orderBy: { billingPeriod: "desc" },
      },
    },
  });

  const items = tenancies.map((tenancy) => {
    const sum = (
      type: "RECEIPT" | "REFUND" | "DEDUCTION" | "APPLIED_TO_INVOICE",
    ) =>
      tenancy.depositTransactions
        .filter((item) => item.type === type)
        .reduce(
          (total, item) => total.plus(item.amount),
          new Prisma.Decimal(0),
        );
    const received = sum("RECEIPT");
    const refunded = sum("REFUND");
    const deductions = sum("DEDUCTION");
    const applied = sum("APPLIED_TO_INVOICE");
    const held = received.minus(refunded).minus(deductions).minus(applied);
    const expected = new Prisma.Decimal(tenancy.depositVnd?.toString() ?? "0");
    const status = received.isZero()
      ? "EXPECTED"
      : received.lessThan(expected)
        ? "PARTIALLY_RECEIVED"
        : held.isZero()
          ? "SETTLED"
          : tenancy.moveOutDate
            ? "NEEDS_SETTLEMENT"
            : "HELD";
    const invoices = tenancy.invoices
      .map((invoice) => {
        const financials = calculateInvoiceFinancials({
          lineAmounts: invoice.lines.map((line) => line.finalAmount),
          adjustments: invoice.adjustments,
          payments: invoice.payments,
        });
        return {
          id: invoice.id,
          room: invoice.roomNameSnapshot,
          billingPeriod: invoice.billingPeriod,
          invoiceType: invoice.type,
          balance: financials.outstanding,
        };
      })
      .filter((invoice) => BigInt(invoice.balance) > BigInt(0));

    let running = new Prisma.Decimal(0);
    const history = tenancy.depositTransactions
      .map((item) => {
        const positive = item.type === "RECEIPT";
        running = positive
          ? running.plus(item.amount)
          : running.minus(item.amount);
        return {
          id: item.id,
          transactionDate: item.transactionDate,
          type: item.type,
          category: item.category,
          reference: item.reference,
          notes: item.notes,
          invoiceId: item.invoiceId,
          invoice: (() => {
            const invoice = item.invoiceId
              ? tenancy.invoices.find(
                  (candidate) => candidate.id === item.invoiceId,
                )
              : null;
            return invoice
              ? {
                  id: invoice.id,
                  type: invoice.type,
                  billingPeriod: invoice.billingPeriod,
                }
              : null;
          })(),
          amount: item.amount.toString(),
          effect: `${positive ? "+" : "-"}${item.amount.toString()}`,
          balanceAfter: running.toString(),
          description:
            item.type === "RECEIPT"
              ? "Deposit receipt"
              : item.type === "REFUND"
                ? "Deposit refund"
                : item.type === "APPLIED_TO_INVOICE"
                  ? "Applied to invoice"
                  : `${label(item.category ?? "OTHER")} deduction`,
        };
      })
      .reverse();
    return {
      tenancyId: tenancy.id,
      tenantName: tenancy.occupants[0]?.person.fullName ?? "Tenant",
      room: tenancy.space.name,
      expected: expected.toString(),
      received: received.toString(),
      held: held.toString(),
      deductions: deductions.toString(),
      refunded: refunded.toString(),
      applied: applied.toString(),
      status: status as
        | "EXPECTED"
        | "PARTIALLY_RECEIVED"
        | "HELD"
        | "NEEDS_SETTLEMENT"
        | "SETTLED",
      invoices,
      history,
    };
  });

  return {
    items,
    summary: {
      expected: sumItems(items, "expected"),
      received: sumItems(items, "received"),
      held: sumItems(items, "held"),
      needsSettlement: items.filter(
        (item) => item.status === "NEEDS_SETTLEMENT",
      ).length,
    },
  };
}

function sumItems(
  items: Array<{ expected: string; received: string; held: string }>,
  key: "expected" | "received" | "held",
) {
  return items
    .reduce((sum, item) => sum.plus(item[key]), new Prisma.Decimal(0))
    .toString();
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export async function getDeposits(propertyId: string) {
  return (await getDepositOverview(propertyId)).items;
}
