import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateInvoiceFinancials } from "@/modules/billing/domain/invoice-financials";
import { toDateOnly } from "@/lib/presentation";
import { getDepositOverview } from "@/modules/billing/server/deposit.queries";
import { operationsDb } from "@/modules/operations/server/operations-db";

import type { DepositReportProjection, ExpenseReportProjection, FinancialReportProjection, OccupancyReportProjection, ReportsProjection, RevenueReportProjection, UtilityReportProjection } from "../domain/types";

const ZERO = () => new Prisma.Decimal(0);
const DAY_MS = 86_400_000;
function businessToday() { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); }
function monthStart(year: number, monthIndex: number) { return new Date(Date.UTC(year, monthIndex, 1)); }
function yearBounds(year: number) { return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) }; }
function monthKey(value: Date) { return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`; }
function monthLabel(value: Date) { return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(value); }
function invoiceTotal(invoice: { lines: Array<{ finalAmount: Prisma.Decimal }>; adjustments: Array<{ type: string; amount: Prisma.Decimal }> }) { const financials = calculateInvoiceFinancials({ lineAmounts: invoice.lines.map((line) => line.finalAmount), adjustments: invoice.adjustments }); return new Prisma.Decimal(financials.effectiveTotal); }
function paidTotal(invoice: { payments: Array<{ amount: Prisma.Decimal }> }) { return invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), ZERO()); }
function clampPercent(value: number) { return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); }

export async function getReportsProjection(year: number): Promise<ReportsProjection | null> {
  const property = await prisma.property.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!property) return null;

  const safeYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : businessToday().getUTCFullYear();
  const [financial, revenue, expenses, occupancy, utilities, deposits, earliest] = await Promise.all([
    getFinancialReport(property.id, safeYear),
    getRevenueReport(property.id, safeYear),
    getExpenseReport(property.id, safeYear),
    getOccupancyReport(property.id, safeYear),
    getUtilityReport(property.id, safeYear),
    getDepositReport(property.id, safeYear),
    getEarliestReportingYear(property.id),
  ]);
  const currentYear = businessToday().getUTCFullYear();
  const first = Math.min(earliest ?? currentYear, safeYear, currentYear);
  const last = Math.max(safeYear, currentYear);
  const availableYears = Array.from({ length: last - first + 1 }, (_, index) => last - index);

  return {
    propertyId: property.id,
    propertyName: property.name,
    year: safeYear,
    availableYears,
    financial,
    revenue,
    expenses,
    occupancy,
    utilities,
    deposits,
  };
}

async function getEarliestReportingYear(propertyId: string) {
  const operations = operationsDb();
  const [invoice, payment, expense, tenancy] = await Promise.all([
    prisma.invoice.findFirst({
      where: { tenancy: { space: { floor: { propertyId } } } },
      orderBy: { billingPeriod: "asc" },
      select: { billingPeriod: true },
    }),
    prisma.payment.findFirst({
      where: { invoice: { tenancy: { space: { floor: { propertyId } } } } },
      orderBy: { paymentDate: "asc" },
      select: { paymentDate: true },
    }),
    operations.expense!.findFirst({
      where: { propertyId, archivedAt: null },
      orderBy: { expenseDate: "asc" },
      select: { expenseDate: true },
    }),
    prisma.tenancy.findFirst({
      where: { space: { floor: { propertyId } } },
      orderBy: { moveInDate: "asc" },
      select: { moveInDate: true },
    }),
  ]);
  const dates = [invoice?.billingPeriod, payment?.paymentDate, expense?.expenseDate, tenancy?.moveInDate].filter((value: unknown): value is Date => value instanceof Date);
  return dates.length ? Math.min(...dates.map((value) => value.getUTCFullYear())) : null;
}

async function getFinancialReport(propertyId: string, year: number): Promise<FinancialReportProjection> {
  const operations = operationsDb();
  const { start, end } = yearBounds(year);
  const [invoices, payments, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "FINALIZED", billingPeriod: { gte: start, lt: end }, tenancy: { space: { floor: { propertyId } } } },
      include: { lines: true, adjustments: true },
    }),
    prisma.payment.findMany({
      where: { paymentDate: { gte: start, lt: end }, isDepositApplication: false, invoice: { tenancy: { space: { floor: { propertyId } } } } },
      select: { amount: true, paymentDate: true },
    }),
    operations.expense!.findMany({
      where: { propertyId, archivedAt: null, expenseDate: { gte: start, lt: end } },
      select: { amount: true, expenseDate: true },
    }),
  ]);
  const rows = Array.from({ length: 12 }, (_, month) => {
    const point = monthStart(year, month);
    return { month: monthKey(point), label: monthLabel(point), billed: ZERO(), collected: ZERO(), expenses: ZERO() };
  });
  const map = new Map(rows.map((row) => [row.month, row]));
  // Decimal is immutable, assign explicitly.
  for (const invoice of invoices) {
    const row = map.get(monthKey(invoice.billingPeriod));
    if (row) row.billed = row.billed.plus(invoiceTotal(invoice));
  }
  for (const payment of payments) {
    const row = map.get(monthKey(payment.paymentDate));
    if (row) row.collected = row.collected.plus(payment.amount);
  }
  for (const expense of expenses) {
    const row = map.get(monthKey(expense.expenseDate));
    if (row) row.expenses = row.expenses.plus(expense.amount);
  }
  const billed = rows.reduce((sum, row) => sum.plus(row.billed), ZERO());
  const collected = rows.reduce((sum, row) => sum.plus(row.collected), ZERO());
  const expenseTotal = rows.reduce((sum, row) => sum.plus(row.expenses), ZERO());
  return {
    year,
    summary: {
      billedVnd: billed.toString(),
      collectedVnd: collected.toString(),
      expensesVnd: expenseTotal.toString(),
      netCashVnd: collected.minus(expenseTotal).toString(),
    },
    monthly: rows.map((row) => ({
      month: row.month,
      label: row.label,
      billedVnd: row.billed.toString(),
      collectedVnd: row.collected.toString(),
      expensesVnd: row.expenses.toString(),
      netCashVnd: row.collected.minus(row.expenses).toString(),
    })),
  };
}

async function getRevenueReport(propertyId: string, year: number): Promise<RevenueReportProjection> {
  const { start, end } = yearBounds(year);
  const invoices = await prisma.invoice.findMany({
    where: { status: "FINALIZED", billingPeriod: { gte: start, lt: end }, tenancy: { space: { floor: { propertyId } } } },
    orderBy: [{ billingPeriod: "desc" }, { roomNameSnapshot: "asc" }],
    include: { lines: true, adjustments: true, payments: true },
  });
  let billed = ZERO();
  let paid = ZERO();
  let outstanding = ZERO();
  const rows = invoices.map((invoice) => {
    const total = invoiceTotal(invoice);
    const applied = paidTotal(invoice);
    const balance = Prisma.Decimal.max(total.minus(applied), 0);
    billed = billed.plus(total);
    paid = paid.plus(Prisma.Decimal.min(applied, total));
    outstanding = outstanding.plus(balance);
    return {
      id: invoice.id,
      billingPeriod: toDateOnly(invoice.billingPeriod),
      room: invoice.roomNameSnapshot,
      tenantName: invoice.renterNameSnapshot,
      billedVnd: total.toString(),
      paidVnd: Prisma.Decimal.min(applied, total).toString(),
      outstandingVnd: balance.toString(),
      paymentStatus: applied.isZero() ? ("UNPAID" as const) : balance.isZero() ? ("PAID" as const) : ("PARTIAL" as const),
      href: `/billing/invoices/${invoice.id}`,
    };
  });
  return { year, summary: { billedVnd: billed.toString(), paidVnd: paid.toString(), outstandingVnd: outstanding.toString() }, rows };
}

async function getExpenseReport(propertyId: string, year: number): Promise<ExpenseReportProjection> {
  const operations = operationsDb();
  const { start, end } = yearBounds(year);
  const expenses = await operations.expense!.findMany({
    where: { propertyId, archivedAt: null, expenseDate: { gte: start, lt: end } },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    include: {
      floor: { select: { name: true } },
      space: { select: { name: true } },
      asset: { select: { name: true } },
      maintenanceIssue: { select: { title: true } },
    },
  });
  const monthly = Array.from({ length: 12 }, (_, month) => ({
    month: monthKey(monthStart(year, month)),
    label: monthLabel(monthStart(year, month)),
    amount: ZERO(),
  }));
  const monthMap = new Map(monthly.map((row) => [row.month, row]));
  const categoryMap = new Map<string, Prisma.Decimal>();
  let total = ZERO();
  let repair = ZERO();
  let utilities = ZERO();
  let other = ZERO();
  for (const expense of expenses) {
    total = total.plus(expense.amount);
    const month = monthMap.get(monthKey(expense.expenseDate));
    if (month) month.amount = month.amount.plus(expense.amount);
    categoryMap.set(expense.category, (categoryMap.get(expense.category) ?? ZERO()).plus(expense.amount));
    if (expense.category === "REPAIR") repair = repair.plus(expense.amount);
    else if (expense.category === "UTILITIES") utilities = utilities.plus(expense.amount);
    else other = other.plus(expense.amount);
  }
  return {
    year,
    summary: { totalVnd: total.toString(), repairVnd: repair.toString(), utilitiesVnd: utilities.toString(), otherVnd: other.toString() },
    monthly: monthly.map((row) => ({ month: row.month, label: row.label, amountVnd: row.amount.toString() })),
    categoryBreakdown: Array.from(categoryMap, ([category, amount]) => ({ category, amountVnd: amount.toString() })).sort((a, b) => Number(b.amountVnd) - Number(a.amountVnd)),
    rows: expenses.map((expense: any) => ({
      id: expense.id,
      expenseDate: toDateOnly(expense.expenseDate),
      description: expense.description,
      category: expense.category,
      location: expense.space?.name ? `${expense.space.name}${expense.floor?.name ? ` · ${expense.floor.name}` : ""}` : expense.floor?.name ?? "Property",
      assetName: expense.asset?.name ?? null,
      maintenanceTitle: expense.maintenanceIssue?.title ?? null,
      amountVnd: expense.amount.toString(),
    })),
  };
}

async function getOccupancyReport(propertyId: string, year: number): Promise<OccupancyReportProjection> {
  const { start, end } = yearBounds(year);
  const today = businessToday();
  const reportEnd = year === today.getUTCFullYear() ? new Date(today.getTime() + DAY_MS) : end;
  const spaces = await prisma.space.findMany({
    where: { archivedAt: null, type: "ROOM", floor: { propertyId } },
    orderBy: [{ floor: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      tenancies: {
        where: { moveInDate: { lt: reportEnd }, OR: [{ moveOutDate: null }, { moveOutDate: { gt: start } }] },
        select: { moveInDate: true, moveOutDate: true },
        orderBy: { moveInDate: "asc" },
      },
    },
  });
  const roomTotals = new Map<string, { occupied: number; available: number }>();
  const monthly = Array.from({ length: 12 }, (_, month) => ({
    month: monthKey(monthStart(year, month)),
    label: monthLabel(monthStart(year, month)),
    occupied: 0,
    available: 0,
  }));
  let moveIns = 0;
  let moveOuts = 0;
  for (const space of spaces) {
    const room = { occupied: 0, available: 0 };
    for (let month = 0; month < 12; month += 1) {
      const monthBegin = monthStart(year, month);
      const naturalMonthEnd = monthStart(year, month + 1);
      const monthEnd = naturalMonthEnd < reportEnd ? naturalMonthEnd : reportEnd;
      const available = monthBegin < reportEnd ? Math.max(0, Math.round((monthEnd.getTime() - monthBegin.getTime()) / DAY_MS)) : 0;
      const intervals = space.tenancies
        .map((tenancy) => ({
          start: tenancy.moveInDate > monthBegin ? tenancy.moveInDate : monthBegin,
          end: tenancy.moveOutDate && tenancy.moveOutDate < monthEnd ? tenancy.moveOutDate : monthEnd,
        }))
        .filter((interval) => interval.start < interval.end)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const merged: Array<{ start: Date; end: Date }> = [];
      for (const interval of intervals) {
        const last = merged.at(-1);
        if (!last || interval.start > last.end) merged.push({ ...interval });
        else if (interval.end > last.end) last.end = interval.end;
      }
      const occupied = merged.reduce((sum, interval) => sum + Math.round((interval.end.getTime() - interval.start.getTime()) / DAY_MS), 0);
      monthly[month].occupied += occupied;
      monthly[month].available += available;
      room.occupied += occupied;
      room.available += available;
    }
    roomTotals.set(space.id, room);
    moveIns += space.tenancies.filter((tenancy) => tenancy.moveInDate >= start && tenancy.moveInDate < reportEnd).length;
    moveOuts += space.tenancies.filter((tenancy) => tenancy.moveOutDate && tenancy.moveOutDate >= start && tenancy.moveOutDate < reportEnd).length;
  }
  const occupiedRoomDays = monthly.reduce((sum, row) => sum + row.occupied, 0);
  const availableRoomDays = monthly.reduce((sum, row) => sum + row.available, 0);
  const vacantRoomDays = Math.max(availableRoomDays - occupiedRoomDays, 0);
  return {
    year,
    summary: {
      occupancyRate: availableRoomDays ? clampPercent((occupiedRoomDays / availableRoomDays) * 100) : 0,
      occupiedRoomDays,
      vacantRoomDays,
      availableRoomDays,
      moveIns,
      moveOuts,
    },
    monthly: monthly.filter((row) => row.available > 0).map((row) => ({
      month: row.month,
      label: row.label,
      occupancyRate: row.available ? clampPercent((row.occupied / row.available) * 100) : 0,
      occupiedRoomDays: row.occupied,
      vacantRoomDays: Math.max(row.available - row.occupied, 0),
    })),
    roomBreakdown: spaces.map((space) => {
      const total = roomTotals.get(space.id) ?? { occupied: 0, available: 0 };
      return {
        spaceId: space.id,
        room: space.name,
        occupancyRate: total.available ? clampPercent((total.occupied / total.available) * 100) : 0,
        occupiedDays: total.occupied,
        vacantDays: Math.max(total.available - total.occupied, 0),
      };
    }),
  };
}

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberFromJson(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function getUtilityReport(propertyId: string, year: number): Promise<UtilityReportProjection> {
  const { start, end } = yearBounds(year);
  const lines = await prisma.invoiceLine.findMany({
    where: {
      type: { in: ["ELECTRICITY", "WATER"] },
      sourceBillingMonth: { gte: start, lt: end },
      invoice: { status: "FINALIZED", tenancy: { space: { floor: { propertyId } } } },
    },
    select: {
      type: true,
      sourceBillingMonth: true,
      finalAmount: true,
      metadata: true,
      invoice: { select: { roomNameSnapshot: true } },
    },
  });
  const electricityMonthly = Array.from({ length: 12 }, (_, month) => ({
    month: monthKey(monthStart(year, month)), label: monthLabel(monthStart(year, month)), usage: 0, charge: ZERO(),
  }));
  const waterMonthly = Array.from({ length: 12 }, (_, month) => ({
    month: monthKey(monthStart(year, month)), label: monthLabel(monthStart(year, month)), people: 0, charge: ZERO(),
  }));
  const eMap = new Map(electricityMonthly.map((row) => [row.month, row]));
  const wMap = new Map(waterMonthly.map((row) => [row.month, row]));
  const roomMap = new Map<string, { usage: number; charge: Prisma.Decimal }>();
  for (const line of lines) {
    if (!line.sourceBillingMonth) continue;
    const metadata = jsonRecord(line.metadata);
    const key = monthKey(line.sourceBillingMonth);
    if (line.type === "ELECTRICITY") {
      const usage = numberFromJson(metadata.tenantKwh);
      const row = eMap.get(key);
      if (row) { row.usage += usage; row.charge = row.charge.plus(line.finalAmount); }
      const room = roomMap.get(line.invoice.roomNameSnapshot) ?? { usage: 0, charge: ZERO() };
      room.usage += usage;
      room.charge = room.charge.plus(line.finalAmount);
      roomMap.set(line.invoice.roomNameSnapshot, room);
    } else {
      const occupants = Array.isArray(metadata.occupants) ? metadata.occupants.length : 0;
      const row = wMap.get(key);
      if (row) { row.people += occupants; row.charge = row.charge.plus(line.finalAmount); }
    }
  }
  const totalUsage = electricityMonthly.reduce((sum, row) => sum + row.usage, 0);
  const totalElectricityCharge = electricityMonthly.reduce((sum, row) => sum.plus(row.charge), ZERO());
  const totalWaterCharge = waterMonthly.reduce((sum, row) => sum.plus(row.charge), ZERO());
  const totalPeople = waterMonthly.reduce((sum, row) => sum + row.people, 0);
  return {
    year,
    electricity: {
      totalTenantKwh: totalUsage.toFixed(3).replace(/\.000$/, ""),
      totalChargeVnd: totalElectricityCharge.toString(),
      monthly: electricityMonthly.map((row) => ({ month: row.month, label: row.label, tenantKwh: row.usage.toFixed(3).replace(/\.000$/, ""), chargeVnd: row.charge.toString() })),
      rooms: Array.from(roomMap, ([room, data]) => ({ room, tenantKwh: data.usage.toFixed(3).replace(/\.000$/, ""), chargeVnd: data.charge.toString() })).sort((a, b) => Number(b.tenantKwh) - Number(a.tenantKwh)),
    },
    water: {
      totalChargeVnd: totalWaterCharge.toString(),
      totalBillablePeople: totalPeople,
      monthly: waterMonthly.map((row) => ({ month: row.month, label: row.label, billablePeople: row.people, chargeVnd: row.charge.toString() })),
    },
  };
}

async function getDepositReport(propertyId: string, year: number): Promise<DepositReportProjection> {
  const overview = await getDepositOverview(propertyId);
  const { start, end } = yearBounds(year);
  let expected = ZERO();
  let received = ZERO();
  let held = ZERO();
  let refunded = ZERO();
  let deducted = ZERO();
  let applied = ZERO();
  const rows = overview.items.map((item) => {
    let rowReceived = ZERO();
    let rowRefunded = ZERO();
    let rowDeducted = ZERO();
    let rowApplied = ZERO();
    for (const event of item.history) {
      const eventDate = new Date(`${event.transactionDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
      if (eventDate < start || eventDate >= end) continue;
      const amount = new Prisma.Decimal(event.amount);
      if (event.type === "RECEIPT") rowReceived = rowReceived.plus(amount);
      else if (event.type === "REFUND") rowRefunded = rowRefunded.plus(amount);
      else if (event.type === "DEDUCTION") rowDeducted = rowDeducted.plus(amount);
      else if (event.type === "APPLIED_TO_INVOICE") rowApplied = rowApplied.plus(amount);
    }
    const rowHeld = new Prisma.Decimal(item.held);
    expected = expected.plus(item.expected);
    received = received.plus(rowReceived);
    held = held.plus(rowHeld);
    refunded = refunded.plus(rowRefunded);
    deducted = deducted.plus(rowDeducted);
    applied = applied.plus(rowApplied);
    return {
      tenancyId: item.tenancyId,
      tenantName: item.tenantName,
      room: item.room,
      expectedVnd: item.expected,
      receivedVnd: rowReceived.toString(),
      heldVnd: item.held,
      refundedVnd: rowRefunded.toString(),
      deductedVnd: rowDeducted.toString(),
      appliedVnd: rowApplied.toString(),
    };
  });
  return {
    year,
    summary: { expectedVnd: expected.toString(), receivedVnd: received.toString(), heldVnd: held.toString(), refundedVnd: refunded.toString(), deductedVnd: deducted.toString(), appliedVnd: applied.toString() },
    rows,
  };
}
