import type { CSSProperties } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Coins,
  CreditCard,
  Gauge,
  Home,
  Layers3,
  ReceiptText,
  ShieldAlert,
  Users,
  WalletCards,
  WifiOff,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { AppLocale } from "@/i18n/config";
import {
  formatCompactDateLocale,
  formatDateOnlyLocale,
  formatMonthLocale,
  formatNumberLocale,
  formatPercentLocale,
  formatVndLocale,
} from "@/i18n/format";
import { MiniBuildingVisual } from "@/modules/property/components/visual/mini-building-visual";
import type {
  DashboardAttentionGroup,
  DashboardAttentionItem,
  DashboardProjection,
} from "../domain/types";
import { FinancialTrendChart, FinancialTrendLegend } from "./analytics-charts";
import "./analytics.css";

export function DashboardView({ view }: { view: DashboardProjection }) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as AppLocale;
  const chartLabels = {
    billed: t("charts.billed"),
    collected: t("charts.collected"),
    expenses: t("charts.expenses"),
    ariaLabel: t("charts.financialTrendAria"),
  };

  return (
    <main className="analytics-page dashboard-page">
      <header className="analytics-page-header dashboard-page-header">
        <div>
          <p className="analytics-eyebrow">{t("overview")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <div className="analytics-period-pill">
          <CalendarClock aria-hidden="true" />
          <span>{t("currentMonth")}</span>
          <strong>{formatMonthLocale(view.period.month, locale)}</strong>
        </div>
      </header>

      <section className="dashboard-hero-grid">
        <article className="analytics-card dashboard-building-card">
          <div className="analytics-card-heading dashboard-building-heading">
            <div>
              <span className="analytics-section-kicker">{t("digitalTwin")}</span>
              <h2>{view.propertyName}</h2>
              <p className="dashboard-building-context">
                {t("propertyContext", {
                  rentalRooms: view.propertySummary.rentalRoomCount,
                  floors: view.propertySummary.floorCount,
                  spaces: view.propertySummary.rentalRoomCount + view.propertySummary.otherSpaceCount,
                })}
              </p>
            </div>
            <Link className="analytics-text-link" href="/building">{t("openBuilding")} <ArrowRight /></Link>
          </div>

          <div className="dashboard-digital-twin-body">
            <MiniBuildingVisual projection={view.building} />
            <DigitalTwinSummary view={view} />
          </div>
        </article>

        <AttentionCard
          groups={view.attentionGroups}
          items={view.attentionItems}
          total={view.attentionTotal}
        />
      </section>

      <section className="dashboard-financial-grid" aria-label={t("financialSummary")}>
        <FinancialCard icon={ReceiptText} label={t("billedRevenue")} value={view.financial.billedVnd} insight={t("finalizedInvoices", { count: view.financial.finalizedInvoiceCount })} href="/billing/invoices" />
        <FinancialCard icon={Banknote} label={t("cashCollected")} value={view.financial.collectedVnd} insight={t("paymentsThisMonth", { count: view.financial.paymentCount })} href="/billing/payments" />
        <FinancialCard icon={WalletCards} label={t("expenses")} value={view.financial.expensesVnd} insight={t("ownerCosts", { count: view.financial.expenseCount })} href="/operations/expenses" />
        <FinancialCard icon={CircleDollarSign} label={t("netCash")} value={view.financial.netCashVnd} insight={t("collectedMinusExpenses")} negative={view.financial.netCashVnd.startsWith("-")} />
      </section>

      <section className="dashboard-middle-grid">
        <article className="analytics-card dashboard-trend-card">
          <div className="analytics-card-heading dashboard-trend-heading">
            <div>
              <span className="analytics-section-kicker">{t("lastSixMonths")}</span>
              <h2>{t("financialTrend")}</h2>
              <p className="analytics-card-subtitle">{t("financialTrendSubtitle")}</p>
            </div>
            <div className="dashboard-trend-actions">
              <FinancialTrendLegend labels={chartLabels} compact />
              <Link className="analytics-text-link" href="/reports?tab=financial">{t("viewReport")} <ArrowRight /></Link>
            </div>
          </div>
          <FinancialTrendChart points={view.financialTrend} locale={locale} labels={chartLabels} compact hideLegend />
        </article>

        <BillingStatusCard view={view} />
      </section>

      <section className="dashboard-lower-grid">
        <RecentPayments view={view} />
        <Upcoming view={view} />
      </section>
    </main>
  );
}

function DigitalTwinSummary({ view }: { view: DashboardProjection }) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as AppLocale;
  const rate = Math.max(0, Math.min(100, view.occupancy.rate));
  const rateLabel = formatNumberLocale(rate, locale, { maximumFractionDigits: 0 });

  return (
    <aside className="dashboard-twin-summary" aria-label={t("propertySummary")}>
      <div className="dashboard-occupancy-ring-wrap">
        <div
          className="dashboard-occupancy-ring"
          style={{ "--occupancy-rate": `${rate * 3.6}deg` } as CSSProperties}
          aria-label={t("occupiedPercent", { rate: rateLabel })}
        >
          <span>
            <strong>{view.occupancy.occupiedRooms}/{view.occupancy.totalRentableRooms}</strong>
            <small>{t("rooms")}</small>
          </span>
        </div>
        <div>
          <span>{t("occupancy")}</span>
          <strong>{t("occupiedPercent", { rate: rateLabel })}</strong>
        </div>
      </div>

      <div className="dashboard-property-stats">
        <PropertyStat icon={Home} value={view.propertySummary.rentalRoomCount} label={t("rentalRooms")} />
        <PropertyStat icon={Layers3} value={view.propertySummary.floorCount} label={t("floors")} />
        <PropertyStat icon={Building2} value={view.propertySummary.otherSpaceCount} label={t("otherSpaces")} />
      </div>
    </aside>
  );
}

function PropertyStat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="dashboard-property-stat">
      <span><Icon aria-hidden="true" /></span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function FinancialCard({ icon: Icon, label, value, insight, href, negative = false }: { icon: LucideIcon; label: string; value: string; insight: string; href?: string; negative?: boolean }) {
  const locale = useLocale() as AppLocale;
  const content = (
    <>
      <span className="analytics-summary-icon"><Icon aria-hidden="true" /></span>
      <div>
        <span>{label}</span>
        <strong className={negative ? "is-negative-value" : undefined}>{formatVndLocale(value, locale)}</strong>
        <small>{insight}</small>
      </div>
    </>
  );
  return href ? <Link href={href} className="analytics-summary-card is-link">{content}</Link> : <article className="analytics-summary-card">{content}</article>;
}

function BillingStatusCard({ view }: { view: DashboardProjection }) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as AppLocale;
  const summary = view.billingSummary;
  const unresolvedCount = summary.unpaidInvoiceCount + summary.partialInvoiceCount;
  const hasFinalized = summary.finalizedInvoiceCount > 0;
  const statusCopy = !hasFinalized
    ? t("noFinalizedInvoices")
    : unresolvedCount === 0
      ? t("allInvoicesCollected", { count: summary.finalizedInvoiceCount })
      : t("unresolvedInvoices", { count: unresolvedCount });
  const month = formatMonthLocale(view.period.month, locale);

  return (
    <article className="analytics-card dashboard-billing-card">
      <div className="analytics-card-heading">
        <div>
          <span className="analytics-section-kicker">{t("currentCycle")}</span>
          <h2>{t("billingStatus")}</h2>
          <p className="analytics-card-subtitle">{t("billingStatusSubtitle", { month })}</p>
        </div>
        <span className="billing-heading-icon" aria-hidden="true"><CreditCard /></span>
      </div>

      <div className="billing-status-hero">
        <span>{t("outstanding")}</span>
        <strong>{formatVndLocale(summary.outstandingVnd, locale)}</strong>
        <small>{statusCopy}</small>
      </div>

      <div className="billing-status-metrics" aria-label={t("billingSummary")}>
        <div className="billing-status-metric">
          <span className="billing-status-metric-icon"><ReceiptText aria-hidden="true" /></span>
          <div>
            <small>{t("billed")}</small>
            <strong>{formatVndLocale(summary.billedVnd, locale)}</strong>
          </div>
        </div>
        <div className="billing-status-metric">
          <span className="billing-status-metric-icon is-success"><Banknote aria-hidden="true" /></span>
          <div>
            <small>{t("collected")}</small>
            <strong>{formatVndLocale(summary.paidVnd, locale)}</strong>
          </div>
        </div>
      </div>

      {hasFinalized ? (
        <>
          <div className="billing-status-progress-block">
            <div className="billing-status-progress-copy">
              <span>{t("collectionProgress")}</span>
              {summary.collectionRate !== null ? <strong>{formatPercentLocale(summary.collectionRate, locale, 0)}</strong> : null}
            </div>
            {summary.collectionRate !== null ? (
              <div className="billing-status-progress" aria-label={`${t("collectionProgress")}: ${formatPercentLocale(summary.collectionRate, locale, 0)}`}>
                <i style={{ width: `${summary.collectionRate}%` }} />
              </div>
            ) : null}
          </div>
          <div className="billing-status-meta">
            <span><b>{summary.unpaidInvoiceCount}</b> {t("unpaid")}</span>
            <span><b>{summary.partialInvoiceCount}</b> {t("partial")}</span>
            <span><b>{summary.paidInvoiceCount}</b> {t("paid")}</span>
          </div>
        </>
      ) : null}

      <Link className="analytics-text-link billing-status-link" href="/billing/invoices">{t("viewInvoices")} <ArrowRight /></Link>
    </article>
  );
}

function AttentionCard({ groups, items, total }: { groups: DashboardAttentionGroup[]; items: DashboardAttentionItem[]; total: number }) {
  const t = useTranslations("dashboard");
  return (
    <article className="analytics-card dashboard-attention-card">
      <div className="analytics-card-heading">
        <div>
          <span className="analytics-section-kicker">{t("operationalQueue")}</span>
          <h2>{t("needsAttention")}</h2>
        </div>
        {total > 0 && <span className="attention-count">{total}</span>}
      </div>
      {groups.length ? (
        <>
          <div className="attention-group-list">
            {groups.slice(0, 6).map((group) => <AttentionGroupRow key={group.id} group={group} />)}
          </div>
          <details className="attention-more attention-details">
            <summary>{t("viewAllItems")} <ArrowRight aria-hidden="true" /></summary>
            <div className="attention-list is-expanded">
              {items.map((item) => <AttentionItem key={item.id} item={item} />)}
            </div>
          </details>
        </>
      ) : (
        <div className="analytics-empty compact"><ClipboardCheck /><strong>{t("nothingUrgent")}</strong><span>{t("operationsClear")}</span></div>
      )}
    </article>
  );
}

function AttentionGroupRow({ group }: { group: DashboardAttentionGroup }) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as AppLocale;
  const Icon = attentionIcon(group.type, group.severity);
  let title: string;
  let summary: string;

  switch (group.type) {
    case "BILLING":
      title = t("attention.unpaidInvoices");
      summary = t("attention.invoiceOutstandingSummary", {
        count: group.count,
        amount: formatVndLocale(group.amountVnd ?? "0", locale),
      });
      break;
    case "UTILITIES":
      title = t("attention.utilityData");
      summary = t("attention.utilityIssues", { count: group.count });
      break;
    case "MAINTENANCE":
      title = group.severity === "URGENT" ? t("attention.urgentMaintenance") : t("attention.maintenanceAttention");
      summary = t("attention.activeIssues", { count: group.count });
      break;
    case "TASK":
      title = t("attention.overdueTasks");
      summary = t("attention.overdueTaskCount", { count: group.count });
      break;
    case "ASSET":
      title = t("attention.assetAttention");
      summary = t("attention.assetIssues", { count: group.count });
      break;
    case "DEVICE":
      title = t("attention.offlineDevices");
      summary = t("attention.offlineDeviceCount", { count: group.count });
      break;
    case "TENANCY":
      title = t("attention.tenancyAttention");
      summary = t("attention.tenancyItems", { count: group.count });
      break;
  }

  return (
    <Link href={group.href} className={`attention-group-row severity-${group.severity.toLowerCase()}`}>
      <span className="attention-item-icon"><Icon aria-hidden="true" /></span>
      <span className="attention-item-copy"><strong>{title}</strong><small>{summary}</small></span>
      <span className="attention-group-count">{group.count}</span>
      <ArrowRight aria-hidden="true" className="attention-item-arrow" />
    </Link>
  );
}

function AttentionItem({ item }: { item: DashboardAttentionItem }) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as AppLocale;
  const Icon = attentionIcon(item.type, item.severity);
  let title = "";
  let detail = item.subject;

  switch (item.code) {
    case "INVOICE_UNPAID":
    case "INVOICE_PARTIAL": {
      title = item.code === "INVOICE_UNPAID" ? t("attention.finalizedInvoiceUnpaid") : t("attention.invoicePartiallyPaid");
      const parts = [item.subject];
      if (item.date) parts.push(formatMonthLocale(item.date, locale));
      if (item.amountVnd) parts.push(t("attention.outstandingAmount", { amount: formatVndLocale(item.amountVnd, locale) }));
      detail = parts.join(" · ");
      break;
    }
    case "UTILITY_BOUNDARY":
      title = t("attention.utilityBoundaryMissing");
      detail = `${item.subject} · ${t("attention.boundaryReadingRequired")}`;
      break;
    case "UTILITY_CLOSING":
      title = t("attention.electricityClosingRequired");
      detail = item.date ? `${item.subject} · ${formatMonthLocale(item.date, locale)}` : item.subject;
      break;
    case "UTILITY_ATTENTION":
      title = t("attention.utilityData");
      detail = `${item.subject} · ${t("attention.utilityIssueCount", { count: item.count ?? 0 })}`;
      break;
    case "MAINTENANCE_URGENT":
      title = t("attention.urgentMaintenance");
      detail = [item.subject, item.context].filter(Boolean).join(" · ");
      break;
    case "MAINTENANCE_HIGH":
      title = t("attention.highPriorityMaintenance");
      detail = [item.subject, item.context].filter(Boolean).join(" · ");
      break;
    case "TASK_OVERDUE":
      title = t("attention.taskOverdue");
      detail = item.date ? `${item.subject} · ${t("attention.due", { date: formatDateOnlyLocale(item.date, locale) })}` : item.subject;
      break;
    case "DEVICE_OFFLINE":
      title = t("attention.deviceOffline");
      detail = [item.subject, item.context].filter(Boolean).join(" · ");
      break;
  }

  return (
    <Link href={item.href} className={`attention-item severity-${item.severity.toLowerCase()}`}>
      <span className="attention-item-icon"><Icon aria-hidden="true" /></span>
      <span className="attention-item-copy"><strong>{title}</strong><small>{detail}</small></span>
      <ArrowRight aria-hidden="true" className="attention-item-arrow" />
    </Link>
  );
}

function attentionIcon(type: DashboardAttentionItem["type"], severity: DashboardAttentionItem["severity"]): LucideIcon {
  if (severity === "BLOCKING" || severity === "URGENT") return ShieldAlert;
  return {
    BILLING: ReceiptText,
    UTILITIES: Gauge,
    MAINTENANCE: Wrench,
    TASK: ClipboardList,
    ASSET: AlertTriangle,
    DEVICE: WifiOff,
    TENANCY: Users,
  }[type];
}

function RecentPayments({ view }: { view: DashboardProjection }) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as AppLocale;
  return (
    <article className="analytics-card dashboard-list-card">
      <div className="analytics-card-heading">
        <div><span className="analytics-section-kicker">{t("cashActivity")}</span><h2>{t("recentPayments")}</h2></div>
        <Link className="analytics-text-link" href="/billing/payments">{t("viewPayments")} <ArrowRight /></Link>
      </div>
      {view.recentPayments.length ? (
        <div className="dashboard-compact-list">
          {view.recentPayments.map((payment) => (
            <Link key={payment.id} href={payment.href} className="dashboard-compact-row">
              <span className="dashboard-row-icon"><Coins /></span>
              <span><strong>{payment.tenantName} · {payment.room}</strong><small>{formatCompactDateLocale(payment.paymentDate, locale)}</small></span>
              <b>{formatVndLocale(payment.amountVnd, locale)}</b>
            </Link>
          ))}
        </div>
      ) : <div className="analytics-empty compact"><CreditCard /><strong>{t("noRecentPayments")}</strong><span>{t("paymentsAppear")}</span></div>}
    </article>
  );
}

function Upcoming({ view }: { view: DashboardProjection }) {
  const t = useTranslations("dashboard");
  const locale = useLocale() as AppLocale;
  return (
    <article className="analytics-card dashboard-list-card">
      <div className="analytics-card-heading"><div><span className="analytics-section-kicker">{t("next60Days")}</span><h2>{t("upcoming")}</h2></div></div>
      {view.upcomingItems.length ? (
        <div className="dashboard-compact-list">
          {view.upcomingItems.map((item) => {
            const title = {
              MOVE_IN: t("upcomingType.moveIn"),
              MOVE_OUT: t("upcomingType.moveOut"),
              TASK: t("upcomingType.task"),
              WARRANTY: t("upcomingType.warranty"),
            }[item.type];
            const subject = item.subject || (item.type === "MOVE_IN" || item.type === "MOVE_OUT" ? t("tenantFallback") : "—");
            const description = [subject, item.context].filter(Boolean).join(" · ");
            return (
              <Link key={item.id} href={item.href} className="dashboard-compact-row upcoming-row">
                <time>{formatCompactDateLocale(item.date, locale)}</time>
                <span><strong>{title}</strong><small>{description}</small></span>
                <ArrowRight />
              </Link>
            );
          })}
        </div>
      ) : <div className="analytics-empty compact"><CalendarClock /><strong>{t("nothingScheduled")}</strong><span>{t("noUpcoming")}</span></div>}
    </article>
  );
}
