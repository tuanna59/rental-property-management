import type { CSSProperties } from "react";
import Link from "next/link";
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

import { formatCompactDate, formatVnd } from "@/lib/presentation";
import { MiniBuildingVisual } from "@/modules/property/components/visual/mini-building-visual";
import type {
  DashboardAttentionGroup,
  DashboardAttentionItem,
  DashboardProjection,
} from "../domain/types";
import { FinancialTrendChart, FinancialTrendLegend } from "./analytics-charts";
import "./analytics.css";

export function DashboardView({ view }: { view: DashboardProjection }) {
  return (
    <main className="analytics-page dashboard-page">
      <header className="analytics-page-header dashboard-page-header">
        <div>
          <p className="analytics-eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p>Property operations, cash movement, occupancy, and attention in one place.</p>
        </div>
        <div className="analytics-period-pill">
          <CalendarClock aria-hidden="true" />
          <span>Current month</span>
          <strong>{view.period.label}</strong>
        </div>
      </header>

      <section className="dashboard-hero-grid">
        <article className="analytics-card dashboard-building-card">
          <div className="analytics-card-heading dashboard-building-heading">
            <div>
              <span className="analytics-section-kicker">Digital twin</span>
              <h2>{view.propertyName}</h2>
              <p className="dashboard-building-context">
                {view.propertySummary.rentalRoomCount} rental rooms · {view.propertySummary.floorCount} floors · {view.propertySummary.rentalRoomCount + view.propertySummary.otherSpaceCount} spaces
              </p>
            </div>
            <Link className="analytics-text-link" href="/building">Open building <ArrowRight /></Link>
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

      <section className="dashboard-financial-grid" aria-label="Financial summary">
        <FinancialCard icon={ReceiptText} label="Billed revenue" value={view.financial.billedVnd} insight={`${view.financial.finalizedInvoiceCount} finalized invoice${view.financial.finalizedInvoiceCount === 1 ? "" : "s"}`} href="/billing/invoices" />
        <FinancialCard icon={Banknote} label="Cash collected" value={view.financial.collectedVnd} insight={`${view.financial.paymentCount} payment${view.financial.paymentCount === 1 ? "" : "s"} this month`} href="/billing/payments" />
        <FinancialCard icon={WalletCards} label="Expenses" value={view.financial.expensesVnd} insight={`${view.financial.expenseCount} owner cost${view.financial.expenseCount === 1 ? "" : "s"}`} href="/operations/expenses" />
        <FinancialCard icon={CircleDollarSign} label="Net cash" value={view.financial.netCashVnd} insight="Collected − expenses" negative={view.financial.netCashVnd.startsWith("-")} />
      </section>

      <section className="dashboard-middle-grid">
        <article className="analytics-card dashboard-trend-card">
          <div className="analytics-card-heading dashboard-trend-heading">
            <div>
              <span className="analytics-section-kicker">Last 6 months</span>
              <h2>Financial trend</h2>
              <p className="analytics-card-subtitle">Billed vs collected vs expenses over the last 6 months</p>
            </div>
            <div className="dashboard-trend-actions">
              <FinancialTrendLegend compact />
              <Link className="analytics-text-link" href="/reports?tab=financial">View report <ArrowRight /></Link>
            </div>
          </div>
          <FinancialTrendChart points={view.financialTrend} compact hideLegend />
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
  const rate = Math.max(0, Math.min(100, view.occupancy.rate));
  return (
    <aside className="dashboard-twin-summary" aria-label="Property summary">
      <div className="dashboard-occupancy-ring-wrap">
        <div
          className="dashboard-occupancy-ring"
          style={{ "--occupancy-rate": `${rate * 3.6}deg` } as CSSProperties}
          aria-label={`${rate.toFixed(0)} percent occupied`}
        >
          <span>
            <strong>{view.occupancy.occupiedRooms}/{view.occupancy.totalRentableRooms}</strong>
            <small>rooms</small>
          </span>
        </div>
        <div>
          <span>Occupancy</span>
          <strong>{rate.toFixed(0)}% occupied</strong>
        </div>
      </div>

      <div className="dashboard-property-stats">
        <PropertyStat icon={Home} value={view.propertySummary.rentalRoomCount} label="Rental rooms" />
        <PropertyStat icon={Layers3} value={view.propertySummary.floorCount} label="Floors" />
        <PropertyStat icon={Building2} value={view.propertySummary.otherSpaceCount} label="Other spaces" />
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
  const content = (
    <>
      <span className="analytics-summary-icon"><Icon aria-hidden="true" /></span>
      <div>
        <span>{label}</span>
        <strong className={negative ? "is-negative-value" : undefined}>{formatVnd(value)}</strong>
        <small>{insight}</small>
      </div>
    </>
  );
  return href ? <Link href={href} className="analytics-summary-card is-link">{content}</Link> : <article className="analytics-summary-card">{content}</article>;
}

function BillingStatusCard({ view }: { view: DashboardProjection }) {
  const summary = view.billingSummary;
  const unresolvedCount = summary.unpaidInvoiceCount + summary.partialInvoiceCount;
  const hasFinalized = summary.finalizedInvoiceCount > 0;
  const statusCopy = !hasFinalized
    ? "No finalized invoices in the current billing period."
    : unresolvedCount === 0
      ? `All ${summary.finalizedInvoiceCount} finalized invoice${summary.finalizedInvoiceCount === 1 ? "" : "s"} are fully collected.`
      : `${unresolvedCount} invoice${unresolvedCount === 1 ? "" : "s"} still unpaid or partial.`;

  return (
    <article className="analytics-card dashboard-billing-card">
      <div className="analytics-card-heading">
        <div>
          <span className="analytics-section-kicker">Current cycle</span>
          <h2>Billing status</h2>
          <p className="analytics-card-subtitle">Finalized invoices and applied payments for {view.period.label}</p>
        </div>
        <span className="billing-heading-icon" aria-hidden="true"><CreditCard /></span>
      </div>

      <div className="billing-status-hero">
        <span>Outstanding</span>
        <strong>{formatVnd(summary.outstandingVnd)}</strong>
        <small>{statusCopy}</small>
      </div>

      <div className="billing-status-metrics" aria-label="Billing summary">
        <div className="billing-status-metric">
          <span className="billing-status-metric-icon"><ReceiptText aria-hidden="true" /></span>
          <div>
            <small>Billed</small>
            <strong>{formatVnd(summary.billedVnd)}</strong>
          </div>
        </div>
        <div className="billing-status-metric">
          <span className="billing-status-metric-icon is-success"><Banknote aria-hidden="true" /></span>
          <div>
            <small>Collected</small>
            <strong>{formatVnd(summary.paidVnd)}</strong>
          </div>
        </div>
      </div>

      {hasFinalized ? (
        <>
          <div className="billing-status-progress-block">
            <div className="billing-status-progress-copy">
              <span>Collection progress</span>
              {summary.collectionRate !== null ? <strong>{summary.collectionRate.toFixed(0)}%</strong> : null}
            </div>
            {summary.collectionRate !== null ? (
              <div className="billing-status-progress" aria-label={`${summary.collectionRate.toFixed(0)} percent collected against finalized invoices`}>
                <i style={{ width: `${summary.collectionRate}%` }} />
              </div>
            ) : null}
          </div>
          <div className="billing-status-meta">
            <span><b>{summary.unpaidInvoiceCount}</b> unpaid</span>
            <span><b>{summary.partialInvoiceCount}</b> partial</span>
            <span><b>{summary.paidInvoiceCount}</b> paid</span>
          </div>
        </>
      ) : null}

      <Link className="analytics-text-link billing-status-link" href="/billing/invoices">View invoices <ArrowRight /></Link>
    </article>
  );
}

function AttentionCard({ groups, items, total }: { groups: DashboardAttentionGroup[]; items: DashboardAttentionItem[]; total: number }) {
  return (
    <article className="analytics-card dashboard-attention-card">
      <div className="analytics-card-heading">
        <div>
          <span className="analytics-section-kicker">Operational queue</span>
          <h2>Needs attention</h2>
        </div>
        {total > 0 && <span className="attention-count">{total}</span>}
      </div>
      {groups.length ? (
        <>
          <div className="attention-group-list">
            {groups.slice(0, 6).map((group) => <AttentionGroupRow key={group.id} group={group} />)}
          </div>
          <details className="attention-more attention-details">
            <summary>View all items <ArrowRight aria-hidden="true" /></summary>
            <div className="attention-list is-expanded">
              {items.map((item) => <AttentionItem key={item.id} item={item} />)}
            </div>
          </details>
        </>
      ) : (
        <div className="analytics-empty compact"><ClipboardCheck /><strong>Nothing urgent right now</strong><span>Property operations are currently clear.</span></div>
      )}
    </article>
  );
}

function AttentionGroupRow({ group }: { group: DashboardAttentionGroup }) {
  const Icon = attentionIcon(group.type, group.severity);
  return (
    <Link href={group.href} className={`attention-group-row severity-${group.severity.toLowerCase()}`}>
      <span className="attention-item-icon"><Icon aria-hidden="true" /></span>
      <span className="attention-item-copy"><strong>{group.title}</strong><small>{group.summary}</small></span>
      <span className="attention-group-count">{group.count}</span>
      <ArrowRight aria-hidden="true" className="attention-item-arrow" />
    </Link>
  );
}

function AttentionItem({ item }: { item: DashboardAttentionItem }) {
  const Icon = attentionIcon(item.type, item.severity);
  return (
    <Link href={item.href} className={`attention-item severity-${item.severity.toLowerCase()}`}>
      <span className="attention-item-icon"><Icon aria-hidden="true" /></span>
      <span className="attention-item-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
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
  return (
    <article className="analytics-card dashboard-list-card">
      <div className="analytics-card-heading">
        <div><span className="analytics-section-kicker">Cash activity</span><h2>Recent payments</h2></div>
        <Link className="analytics-text-link" href="/billing/payments">View payments <ArrowRight /></Link>
      </div>
      {view.recentPayments.length ? (
        <div className="dashboard-compact-list">
          {view.recentPayments.map((payment) => (
            <Link key={payment.id} href={payment.href} className="dashboard-compact-row">
              <span className="dashboard-row-icon"><Coins /></span>
              <span><strong>{payment.tenantName} · {payment.room}</strong><small>{formatCompactDate(payment.paymentDate)}</small></span>
              <b>{formatVnd(payment.amountVnd)}</b>
            </Link>
          ))}
        </div>
      ) : <div className="analytics-empty compact"><CreditCard /><strong>No recent payments</strong><span>Payments will appear here when recorded.</span></div>}
    </article>
  );
}

function Upcoming({ view }: { view: DashboardProjection }) {
  return (
    <article className="analytics-card dashboard-list-card">
      <div className="analytics-card-heading"><div><span className="analytics-section-kicker">Next 60 days</span><h2>Upcoming</h2></div></div>
      {view.upcomingItems.length ? (
        <div className="dashboard-compact-list">
          {view.upcomingItems.map((item) => (
            <Link key={item.id} href={item.href} className="dashboard-compact-row upcoming-row">
              <time>{formatCompactDate(item.date)}</time>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
              <ArrowRight />
            </Link>
          ))}
        </div>
      ) : <div className="analytics-empty compact"><CalendarClock /><strong>Nothing scheduled soon</strong><span>No upcoming move, task, or warranty event in the next 60 days.</span></div>}
    </article>
  );
}
