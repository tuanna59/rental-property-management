import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatVnd, toDateOnly } from "@/lib/presentation";
import { assetsDb } from "@/modules/assets/server/assets-db";
import { operationsDb } from "@/modules/operations/server/operations-db";
import { getBuildingVisualProjection } from "@/modules/property/server/property.queries";

import type { DashboardAttentionItem, DashboardAttentionSeverity, DashboardProjection } from "../domain/types";

const ZERO = () => new Prisma.Decimal(0);
const DAY_MS = 86_400_000;
function businessToday() { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); }
function monthStart(year: number, monthIndex: number) { return new Date(Date.UTC(year, monthIndex, 1)); }
function monthKey(value: Date) { return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`; }
function monthLabel(value: Date) { return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(value); }
function monthLabelLong(value: Date) { return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(value); }
function invoiceTotal(invoice: { lines: Array<{ finalAmount: Prisma.Decimal }>; adjustments: Array<{ type: string; amount: Prisma.Decimal }> }) { return invoice.lines.reduce((sum, line) => sum.plus(line.finalAmount), ZERO()).plus(invoice.adjustments.reduce((sum, adjustment) => adjustment.type === "CHARGE" ? sum.plus(adjustment.amount) : sum.minus(adjustment.amount), ZERO())); }
function paidTotal(invoice: { payments: Array<{ amount: Prisma.Decimal }> }) { return invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), ZERO()); }
function severityRank(value: DashboardAttentionSeverity) { return { BLOCKING: 0, URGENT: 1, WARNING: 2, INFO: 3 }[value]; }
function dateOnly(value: Date | null | undefined) { return value ? toDateOnly(value) : null; }
function clampPercent(value: number) { return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); }

export async function getDashboardProjection(): Promise<DashboardProjection | null> {
  const building = await getBuildingVisualProjection();
  if (!building) return null;

  const propertyId = building.id;
  const operations = operationsDb();
  const assets = assetsDb();
  const today = businessToday();
  const currentMonth = monthStart(today.getUTCFullYear(), today.getUTCMonth());
  const nextMonth = monthStart(today.getUTCFullYear(), today.getUTCMonth() + 1);
  const trendStart = monthStart(today.getUTCFullYear(), today.getUTCMonth() - 5);
  const upcomingEnd = new Date(today.getTime() + 60 * DAY_MS);

  const [
    periodInvoices,
    periodPayments,
    periodExpenses,
    trendInvoices,
    trendPayments,
    trendExpenses,
    outstandingInvoices,
    maintenance,
    overdueTasks,
    expiringAssets,
    offlineDevices,
    upcomingTenancies,
    upcomingTasks,
    recentPaymentsRaw,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: "FINALIZED",
        billingPeriod: currentMonth,
        tenancy: { space: { floor: { propertyId } } },
      },
      include: { lines: true, adjustments: true, payments: true },
    }),
    prisma.payment.findMany({
      where: {
        paymentDate: { gte: currentMonth, lt: nextMonth },
        isDepositApplication: false,
        invoice: { tenancy: { space: { floor: { propertyId } } } },
      },
      select: { amount: true },
    }),
    operations.expense!.findMany({
      where: {
        propertyId,
        archivedAt: null,
        expenseDate: { gte: currentMonth, lt: nextMonth },
      },
      select: { amount: true },
    }),
    prisma.invoice.findMany({
      where: {
        status: "FINALIZED",
        billingPeriod: { gte: trendStart, lt: nextMonth },
        tenancy: { space: { floor: { propertyId } } },
      },
      include: { lines: true, adjustments: true },
    }),
    prisma.payment.findMany({
      where: {
        paymentDate: { gte: trendStart, lt: nextMonth },
        isDepositApplication: false,
        invoice: { tenancy: { space: { floor: { propertyId } } } },
      },
      select: { amount: true, paymentDate: true },
    }),
    operations.expense!.findMany({
      where: {
        propertyId,
        archivedAt: null,
        expenseDate: { gte: trendStart, lt: nextMonth },
      },
      select: { amount: true, expenseDate: true },
    }),
    prisma.invoice.findMany({
      where: {
        status: "FINALIZED",
        tenancy: { space: { floor: { propertyId } } },
      },
      orderBy: { billingPeriod: "desc" },
      take: 24,
      include: { lines: true, adjustments: true, payments: true },
    }),
    operations.maintenanceIssue!.findMany({
      where: {
        propertyId,
        archivedAt: null,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        priority: { in: ["HIGH", "URGENT"] },
      },
      orderBy: [{ priority: "desc" }, { reportedAt: "asc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        priority: true,
        reportedAt: true,
        spaceId: true,
        space: { select: { name: true } },
      },
    }),
    operations.task!.findMany({
      where: {
        propertyId,
        archivedAt: null,
        status: "TODO",
        dueDate: { lt: today },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 12,
      select: { id: true, title: true, dueDate: true, priority: true },
    }),
    assets.asset!.findMany({
      where: {
        propertyId,
        archivedAt: null,
        status: "ACTIVE",
        warrantyExpiresAt: { gte: today, lte: new Date(today.getTime() + 30 * DAY_MS) },
      },
      orderBy: { warrantyExpiresAt: "asc" },
      take: 10,
      select: { id: true, name: true, warrantyExpiresAt: true, spaceId: true, space: { select: { name: true } } },
    }),
    assets.device!.findMany({
      where: { propertyId, archivedAt: null, status: "OFFLINE" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, spaceId: true, space: { select: { name: true } } },
    }),
    prisma.tenancy.findMany({
      where: {
        space: { floor: { propertyId } },
        OR: [
          { moveInDate: { gte: today, lte: upcomingEnd } },
          { moveOutDate: { gte: today, lte: upcomingEnd } },
        ],
      },
      orderBy: { moveInDate: "asc" },
      select: {
        id: true,
        moveInDate: true,
        moveOutDate: true,
        spaceId: true,
        space: { select: { name: true } },
        occupants: {
          where: { role: "RESPONSIBLE" },
          orderBy: { startDate: "asc" },
          take: 1,
          select: { person: { select: { fullName: true } } },
        },
      },
    }),
    operations.task!.findMany({
      where: {
        propertyId,
        archivedAt: null,
        status: "TODO",
        dueDate: { gte: today, lte: upcomingEnd },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { id: true, title: true, dueDate: true },
    }),
    prisma.payment.findMany({
      where: {
        isDepositApplication: false,
        invoice: { tenancy: { space: { floor: { propertyId } } } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        invoice: { select: { roomNameSnapshot: true, renterNameSnapshot: true } },
      },
    }),
  ]);

  const billed = periodInvoices.reduce((sum, invoice) => sum.plus(invoiceTotal(invoice)), ZERO());
  const collected = periodPayments.reduce((sum, payment) => sum.plus(payment.amount), ZERO());
  const expenses = periodExpenses.reduce((sum: Prisma.Decimal, expense: any) => sum.plus(expense.amount), ZERO());
  const netCash = collected.minus(expenses);

  const trend = Array.from({ length: 6 }, (_, index) => {
    const point = monthStart(trendStart.getUTCFullYear(), trendStart.getUTCMonth() + index);
    return {
      month: monthKey(point),
      label: monthLabel(point),
      billedVnd: ZERO(),
      collectedVnd: ZERO(),
      expensesVnd: ZERO(),
    };
  });
  const trendMap = new Map(trend.map((point) => [point.month, point]));
  for (const invoice of trendInvoices) {
    const point = trendMap.get(monthKey(invoice.billingPeriod));
    if (point) point.billedVnd = point.billedVnd.plus(invoiceTotal(invoice));
  }
  for (const payment of trendPayments) {
    const point = trendMap.get(monthKey(payment.paymentDate));
    if (point) point.collectedVnd = point.collectedVnd.plus(payment.amount);
  }
  for (const expense of trendExpenses) {
    const point = trendMap.get(monthKey(expense.expenseDate));
    if (point) point.expensesVnd = point.expensesVnd.plus(expense.amount);
  }

  const attention: DashboardAttentionItem[] = [];
  for (const invoice of outstandingInvoices) {
    const total = invoiceTotal(invoice);
    const paid = paidTotal(invoice);
    const balance = total.minus(paid);
    if (!balance.isPositive()) continue;
    attention.push({
      id: `invoice:${invoice.id}`,
      type: "BILLING",
      severity: paid.isZero() ? "WARNING" : "INFO",
      title: paid.isZero() ? "Finalized invoice unpaid" : "Invoice partially paid",
      description: `${invoice.roomNameSnapshot} · ${monthLabelLong(invoice.billingPeriod)} · ${formatVnd(balance.toString())} outstanding`,
      href: `/billing/invoices/${invoice.id}`,
      spaceId: null,
      date: dateOnly(invoice.billingPeriod),
    });
  }
  for (const floor of building.floors) {
    for (const space of floor.spaces) {
      if (space.utilities.missingBoundary) {
        attention.push({
          id: `utility-boundary:${space.id}`,
          type: "UTILITIES",
          severity: "BLOCKING",
          title: "Utility boundary missing",
          description: `${space.name} · boundary reading required`,
          href: `/utilities/meters?month=${monthKey(currentMonth)}`,
          spaceId: space.id,
          date: dateOnly(currentMonth),
        });
      } else if (space.utilities.needsClosing) {
        attention.push({
          id: `utility-closing:${space.id}`,
          type: "UTILITIES",
          severity: "WARNING",
          title: "Electricity closing required",
          description: `${space.name} · ${monthLabelLong(currentMonth)}`,
          href: `/utilities/meters?month=${monthKey(currentMonth)}`,
          spaceId: space.id,
          date: dateOnly(currentMonth),
        });
      } else if (space.utilities.attentionCount > 0) {
        attention.push({
          id: `utility-attention:${space.id}`,
          type: "UTILITIES",
          severity: "WARNING",
          title: "Utility data needs attention",
          description: `${space.name} · ${space.utilities.attentionCount} issue${space.utilities.attentionCount === 1 ? "" : "s"}`,
          href: `/utilities?month=${monthKey(currentMonth)}`,
          spaceId: space.id,
          date: dateOnly(currentMonth),
        });
      }
    }
  }
  for (const issue of maintenance) {
    attention.push({
      id: `maintenance:${issue.id}`,
      type: "MAINTENANCE",
      severity: issue.priority === "URGENT" ? "URGENT" : "WARNING",
      title: issue.priority === "URGENT" ? "Urgent maintenance" : "High priority maintenance",
      description: `${issue.title}${issue.space?.name ? ` · ${issue.space.name}` : ""}`,
      href: `/operations/maintenance?issue=${issue.id}`,
      spaceId: issue.spaceId,
      date: dateOnly(issue.reportedAt),
    });
  }
  for (const task of overdueTasks) {
    attention.push({
      id: `task:${task.id}`,
      type: "TASK",
      severity: task.priority === "HIGH" ? "URGENT" : "WARNING",
      title: "Task overdue",
      description: `${task.title}${task.dueDate ? ` · due ${task.dueDate.toISOString().slice(0, 10)}` : ""}`,
      href: "/operations/tasks",
      spaceId: null,
      date: dateOnly(task.dueDate),
    });
  }
  for (const asset of expiringAssets) {
    attention.push({
      id: `asset:${asset.id}`,
      type: "ASSET",
      severity: "INFO",
      title: "Warranty expiring soon",
      description: `${asset.name}${asset.space?.name ? ` · ${asset.space.name}` : ""}`,
      href: `/assets/${asset.id}`,
      spaceId: asset.spaceId,
      date: dateOnly(asset.warrantyExpiresAt),
    });
  }
  for (const device of offlineDevices) {
    attention.push({
      id: `device:${device.id}`,
      type: "DEVICE",
      severity: "WARNING",
      title: "Device offline",
      description: `${device.name}${device.space?.name ? ` · ${device.space.name}` : ""}`,
      href: "/assets/devices",
      spaceId: device.spaceId,
      date: null,
    });
  }

  attention.sort((left, right) => {
    const severity = severityRank(left.severity) - severityRank(right.severity);
    if (severity) return severity;
    return (left.date ?? "9999-12-31").localeCompare(right.date ?? "9999-12-31");
  });

  const rentableSpaces = building.floors.flatMap((floor) => floor.spaces).filter((space) => space.type === "ROOM");
  const occupied = rentableSpaces.filter((space) => space.occupancyState === "OCCUPIED");
  const currentOccupants = occupied.reduce((sum, space) => sum + (space.occupancy?.occupantCount ?? 0), 0);
  const upcomingMoveIns = rentableSpaces.filter((space) => space.occupancyState === "UPCOMING").length;

  const upcoming = [
    ...upcomingTenancies.flatMap((tenancy) => {
      const tenant = tenancy.occupants[0]?.person.fullName ?? "Tenant";
      const entries = [] as DashboardProjection["upcomingItems"];
      if (tenancy.moveInDate >= today && tenancy.moveInDate <= upcomingEnd) {
        entries.push({
          id: `move-in:${tenancy.id}`,
          type: "MOVE_IN",
          date: toDateOnly(tenancy.moveInDate),
          title: "Move-in",
          description: `${tenant} · ${tenancy.space.name}`,
          href: `/building?space=${tenancy.spaceId}`,
        });
      }
      if (tenancy.moveOutDate && tenancy.moveOutDate >= today && tenancy.moveOutDate <= upcomingEnd) {
        entries.push({
          id: `move-out:${tenancy.id}`,
          type: "MOVE_OUT",
          date: toDateOnly(tenancy.moveOutDate),
          title: "Move-out",
          description: `${tenant} · ${tenancy.space.name}`,
          href: `/building?space=${tenancy.spaceId}`,
        });
      }
      return entries;
    }),
    ...upcomingTasks
      .filter((task: any) => task.dueDate)
      .map((task: any) => ({
        id: `task:${task.id}`,
        type: "TASK" as const,
        date: toDateOnly(task.dueDate!),
        title: "Task due",
        description: task.title,
        href: "/operations/tasks",
      })),
    ...expiringAssets
      .filter((asset: any) => asset.warrantyExpiresAt)
      .map((asset: any) => ({
        id: `warranty:${asset.id}`,
        type: "WARRANTY" as const,
        date: toDateOnly(asset.warrantyExpiresAt!),
        title: "Warranty expires",
        description: asset.name,
        href: `/assets/${asset.id}`,
      })),
  ]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 5);

  return {
    propertyId,
    propertyName: building.name,
    period: { month: monthKey(currentMonth), label: monthLabelLong(currentMonth) },
    financial: {
      billedVnd: billed.toString(),
      collectedVnd: collected.toString(),
      expensesVnd: expenses.toString(),
      netCashVnd: netCash.toString(),
      finalizedInvoiceCount: periodInvoices.length,
      paymentCount: periodPayments.length,
      expenseCount: periodExpenses.length,
    },
    occupancy: {
      occupiedRooms: occupied.length,
      totalRentableRooms: rentableSpaces.length,
      rate: rentableSpaces.length ? clampPercent((occupied.length / rentableSpaces.length) * 100) : 0,
      currentOccupants,
      upcomingMoveIns,
    },
    attentionItems: attention,
    attentionTotal: attention.length,
    financialTrend: trend.map((point) => ({
      month: point.month,
      label: point.label,
      billedVnd: point.billedVnd.toString(),
      collectedVnd: point.collectedVnd.toString(),
      expensesVnd: point.expensesVnd.toString(),
    })),
    recentPayments: recentPaymentsRaw.map((payment) => ({
      id: payment.id,
      tenantName: payment.invoice.renterNameSnapshot,
      room: payment.invoice.roomNameSnapshot,
      amountVnd: payment.amount.toString(),
      paymentDate: toDateOnly(payment.paymentDate),
      href: `/billing/payments?month=${monthKey(payment.paymentDate)}`,
    })),
    upcomingItems: upcoming,
    building,
  };
}
