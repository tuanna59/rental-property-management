import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  CreditCard,
  Gauge,
  ReceiptText,
  ShieldAlert,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { formatCompactDate, formatVnd } from "@/lib/presentation";
import { MiniBuildingVisual } from "@/modules/property/components/visual/mini-building-visual";
import type { DashboardAttentionItem, DashboardProjection } from "../domain/types";
import { FinancialTrendChart } from "./analytics-charts";
import "./analytics.css";

export function DashboardView({ view }: { view: DashboardProjection }) {
  return (
    <main className="analytics-page dashboard-page">
      <header className="analytics-page-header">
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
          <div className="analytics-card-heading">
            <div>
              <span className="analytics-section-kicker">Digital twin</span>
              <h2>{view.propertyName}</h2>
            </div>
            <Link className="analytics-text-link" href="/building">Open Building <ArrowRight /></Link>
          </div>
          <MiniBuildingVisual projection={view.building} />
        </article>

        <AttentionCard items={view.attentionItems} total={view.attentionTotal} />
      </section>

      <section className="dashboard-financial-grid" aria-label="Financial summary">
        <FinancialCard icon={ReceiptText} label="Billed revenue" value={view.financial.billedVnd} insight={`${view.financial.finalizedInvoiceCount} finalized invoice${view.financial.finalizedInvoiceCount === 1 ? "" : "s"}`} href="/billing/invoices" />
        <FinancialCard icon={Banknote} label="Cash collected" value={view.financial.collectedVnd} insight={`${view.financial.paymentCount} payment${view.financial.paymentCount === 1 ? "" : "s"} this month`} href="/billing/payments" />
        <FinancialCard icon={WalletCards} label="Expenses" value={view.financial.expensesVnd} insight={`${view.financial.expenseCount} owner cost${view.financial.expenseCount === 1 ? "" : "s"}`} href="/operations/expenses" />
        <FinancialCard icon={CircleDollarSign} label="Net cash" value={view.financial.netCashVnd} insight="Collected − expenses" />
      </section>

      <section className="dashboard-middle-grid">
        <article className="analytics-card dashboard-trend-card">
          <div className="analytics-card-heading">
            <div>
              <span className="analytics-section-kicker">Last 6 months</span>
              <h2>Financial trend</h2>
            </div>
            <Link className="analytics-text-link" href="/reports?tab=financial">View report <ArrowRight /></Link>
          </div>
          <FinancialTrendChart points={view.financialTrend} />
        </article>

        <article className="analytics-card dashboard-occupancy-card">
          <div className="analytics-card-heading">
            <div>
              <span className="analytics-section-kicker">Current snapshot</span>
              <h2>Occupancy</h2>
            </div>
            <Users aria-hidden="true" className="analytics-heading-icon" />
          </div>
          <div className="occupancy-hero-value">
            <strong>{view.occupancy.occupiedRooms} / {view.occupancy.totalRentableRooms}</strong>
            <span>rentable rooms</span>
          </div>
          <div className="occupancy-progress" aria-label={`${view.occupancy.rate.toFixed(0)} percent occupied`}>
            <i style={{ width: `${view.occupancy.rate}%` }} />
          </div>
          <strong className="occupancy-rate">{view.occupancy.rate.toFixed(0)}%</strong>
          <div className="occupancy-insights">
            <span><b>{view.occupancy.currentOccupants}</b> current occupants</span>
            <span><b>{view.occupancy.upcomingMoveIns}</b> upcoming move-in{view.occupancy.upcomingMoveIns === 1 ? "" : "s"}</span>
          </div>
          <Link className="analytics-text-link occupancy-report-link" href="/reports?tab=occupancy">Occupancy report <ArrowRight /></Link>
        </article>
      </section>

      <section className="dashboard-lower-grid">
        <RecentPayments view={view} />
        <Upcoming view={view} />
      </section>
    </main>
  );
}

function FinancialCard({ icon: Icon, label, value, insight, href }: { icon: LucideIcon; label: string; value: string; insight: string; href?: string }) {
  const content = (
    <>
      <span className="analytics-summary-icon"><Icon aria-hidden="true" /></span>
      <div>
        <span>{label}</span>
        <strong>{formatVnd(value)}</strong>
        <small>{insight}</small>
      </div>
    </>
  );
  return href ? <Link href={href} className="analytics-summary-card is-link">{content}</Link> : <article className="analytics-summary-card">{content}</article>;
}

function AttentionCard({ items, total }: { items: DashboardAttentionItem[]; total: number }) {
  return (
    <article className="analytics-card dashboard-attention-card">
      <div className="analytics-card-heading">
        <div>
          <span className="analytics-section-kicker">Operational queue</span>
          <h2>Needs attention</h2>
        </div>
        {total > 0 && <span className="attention-count">{total}</span>}
      </div>
      {items.length ? (
        <>
          <div className="attention-list">
            {items.slice(0, 7).map((item) => <AttentionItem key={item.id} item={item} />)}
          </div>
          {items.length > 7 && (
            <details className="attention-more">
              <summary>View all {items.length} items</summary>
              <div className="attention-list is-expanded">
                {items.slice(7).map((item) => <AttentionItem key={item.id} item={item} />)}
              </div>
            </details>
          )}
        </>
      ) : (
        <div className="analytics-empty compact"><ClipboardCheck /><strong>Nothing urgent right now</strong><span>Property operations are currently clear.</span></div>
      )}
    </article>
  );
}

function AttentionItem({ item }: { item: DashboardAttentionItem }) {
  const Icon = item.severity === "BLOCKING" || item.severity === "URGENT" ? ShieldAlert : item.type === "UTILITIES" ? Gauge : AlertTriangle;
  return (
    <Link href={item.href} className={`attention-item severity-${item.severity.toLowerCase()}`}>
      <span className="attention-item-icon"><Icon aria-hidden="true" /></span>
      <span className="attention-item-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
      <ArrowRight aria-hidden="true" className="attention-item-arrow" />
    </Link>
  );
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
