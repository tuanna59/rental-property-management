"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  Building2,
  Coins,
  Droplets,
  Gauge,
  Home,
  ReceiptText,
  ShieldCheck,
  Users,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { formatCompactDate, formatVnd } from "@/lib/presentation";
import type { ReportsProjection } from "../domain/types";
import { ExpenseCategoryBars, FinancialTrendChart, OccupancyTrendChart } from "./analytics-charts";
import "./analytics.css";

type ReportTab = "financial" | "revenue" | "expenses" | "occupancy" | "utilities" | "deposits";

const tabs: Array<{ value: ReportTab; label: string }> = [
  { value: "financial", label: "Financial" },
  { value: "revenue", label: "Revenue" },
  { value: "expenses", label: "Expenses" },
  { value: "occupancy", label: "Occupancy" },
  { value: "utilities", label: "Utilities" },
  { value: "deposits", label: "Deposits" },
];

export function ReportsView({ view, initialTab }: { view: ReportsProjection; initialTab: ReportTab }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<ReportTab>(initialTab);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const updateQuery = React.useCallback((next: { tab?: ReportTab; year?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.tab) params.set("tab", next.tab);
    if (next.year) params.set("year", String(next.year));
    router.push(`/reports?${params.toString()}`);
  }, [router, searchParams]);

  const changeTab = (value: ReportTab) => {
    setTab(value);
    updateQuery({ tab: value });
  };

  return (
    <main className="analytics-page reports-page">
      <header className="analytics-page-header">
        <div>
          <p className="analytics-eyebrow">ANALYTICS</p>
          <h1>Reports</h1>
          <p>Review financial, occupancy, utility, and deposit performance.</p>
        </div>
        <label className="reports-year-control">
          <span>Year</span>
          <select value={view.year} onChange={(event) => updateQuery({ year: Number(event.target.value) })}>
            {view.availableYears.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
        </label>
      </header>

      <div className="reports-tabs" role="tablist" aria-label="Reports">
        {tabs.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? "is-active" : undefined} onClick={() => changeTab(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "financial" && <FinancialReport view={view} />}
      {tab === "revenue" && <RevenueReport view={view} />}
      {tab === "expenses" && <ExpenseReport view={view} />}
      {tab === "occupancy" && <OccupancyReport view={view} />}
      {tab === "utilities" && <UtilitiesReport view={view} />}
      {tab === "deposits" && <DepositsReport view={view} />}
    </main>
  );
}

function FinancialReport({ view }: { view: ReportsProjection }) {
  const data = view.financial;
  return (
    <section className="report-panel" role="tabpanel">
      <ReportMoneyCards cards={[
        { label: "Billed revenue", value: data.summary.billedVnd, icon: ReceiptText },
        { label: "Cash collected", value: data.summary.collectedVnd, icon: Banknote },
        { label: "Expenses", value: data.summary.expensesVnd, icon: WalletCards },
        { label: "Net cash", value: data.summary.netCashVnd, icon: Coins },
      ]} />
      {data.monthly.every((row) => row.billedVnd === "0" && row.collectedVnd === "0" && row.expensesVnd === "0") && (
        <div className="report-no-data-note">No finalized invoices, cash payments, or owner expenses were recorded in {view.year}. Zero-value months are still shown for continuity.</div>
      )}
      <div className="reports-two-column">
        <article className="analytics-card report-chart-card">
          <SectionHeading kicker={`${view.year}`} title="Monthly financial activity" />
          <FinancialTrendChart points={data.monthly} />
        </article>
        <article className="analytics-card report-definition-card">
          <SectionHeading kicker="Semantics" title="What these numbers mean" />
          <Definition icon={ReceiptText} title="Billed" text="Finalized invoice totals grouped by invoice billing period." />
          <Definition icon={Banknote} title="Collected" text="Cash payments grouped by payment date. Deposit applications are excluded." />
          <Definition icon={WalletCards} title="Expenses" text="Owner/property Expenses grouped by expense date." />
          <Definition icon={Coins} title="Net cash" text="Cash collected − owner expenses. This is not accounting profit." />
        </article>
      </div>
      <ReportTable headers={["Month", "Billed", "Collected", "Expenses", "Net cash"]}>
        {data.monthly.map((row) => <tr key={row.month}><td>{row.label}</td><td>{formatVnd(row.billedVnd)}</td><td>{formatVnd(row.collectedVnd)}</td><td>{formatVnd(row.expensesVnd)}</td><td className="report-strong-cell">{formatVnd(row.netCashVnd)}</td></tr>)}
      </ReportTable>
    </section>
  );
}

function RevenueReport({ view }: { view: ReportsProjection }) {
  const data = view.revenue;
  const [search, setSearch] = React.useState("");
  const rows = data.rows.filter((row) => `${row.room} ${row.tenantName}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="report-panel" role="tabpanel">
      <ReportMoneyCards cards={[
        { label: "Billed", value: data.summary.billedVnd, icon: ReceiptText },
        { label: "Paid", value: data.summary.paidVnd, icon: Banknote },
        { label: "Outstanding", value: data.summary.outstandingVnd, icon: WalletCards },
      ]} />
      <div className="report-filter-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search room or tenant" aria-label="Search revenue report" /></div>
      {rows.length ? <>
        <div className="report-desktop-only"><ReportTable headers={["Billing period", "Room", "Responsible tenant", "Invoice", "Billed", "Paid", "Outstanding", "Status"]}>
          {rows.map((row) => <tr key={row.id}><td>{row.billingPeriod.slice(0, 7)}</td><td>{row.room}</td><td>{row.tenantName}</td><td><Link className="analytics-inline-link" href={row.href}>INV-{row.id.slice(-6).toUpperCase()}</Link></td><td>{formatVnd(row.billedVnd)}</td><td>{formatVnd(row.paidVnd)}</td><td>{formatVnd(row.outstandingVnd)}</td><td><StatusPill value={row.paymentStatus} /></td></tr>)}
        </ReportTable></div>
        <div className="report-mobile-list">{rows.map((row) => <Link href={row.href} className="report-mobile-card" key={row.id}><div><strong>{row.tenantName} · {row.room}</strong><StatusPill value={row.paymentStatus} /></div><span>{row.billingPeriod.slice(0,7)} · INV-{row.id.slice(-6).toUpperCase()}</span><dl><div><dt>Billed</dt><dd>{formatVnd(row.billedVnd)}</dd></div><div><dt>Paid</dt><dd>{formatVnd(row.paidVnd)}</dd></div><div><dt>Outstanding</dt><dd>{formatVnd(row.outstandingVnd)}</dd></div></dl></Link>)}</div>
      </> : <ReportEmpty icon={ReceiptText} title="No finalized invoices in this view" text="Try another year or search term." />}
    </section>
  );
}

function ExpenseReport({ view }: { view: ReportsProjection }) {
  const data = view.expenses;
  const [category, setCategory] = React.useState("ALL");
  const [location, setLocation] = React.useState("ALL");
  const rows = data.rows.filter((row) => (category === "ALL" || row.category === category) && (location === "ALL" || row.location === location));
  const categories = Array.from(new Set(data.rows.map((row) => row.category)));
  const locations = Array.from(new Set(data.rows.map((row) => row.location))).sort();
  return (
    <section className="report-panel" role="tabpanel">
      <ReportMoneyCards cards={[
        { label: "Total expenses", value: data.summary.totalVnd, icon: WalletCards },
        { label: "Repair", value: data.summary.repairVnd, icon: Gauge },
        { label: "Utilities", value: data.summary.utilitiesVnd, icon: Zap },
        { label: "Other operations", value: data.summary.otherVnd, icon: ReceiptText },
      ]} />
      <div className="reports-two-column">
        <article className="analytics-card report-chart-card"><SectionHeading kicker={`${view.year}`} title="Expenses by month" /><FinancialTrendChart points={data.monthly.map((row) => ({ label: row.label, billedVnd: "0", collectedVnd: "0", expensesVnd: row.amountVnd }))} /></article>
        <article className="analytics-card report-chart-card"><SectionHeading kicker="Categories" title="Expense mix" /><ExpenseCategoryBars points={data.categoryBreakdown} /></article>
      </div>
      <div className="report-filter-row report-filter-multiple"><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Expense category"><option value="ALL">All categories</option>{categories.map((value) => <option value={value} key={value}>{labelEnum(value)}</option>)}</select><select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Expense location"><option value="ALL">All locations</option>{locations.map((value) => <option value={value} key={value}>{value}</option>)}</select></div>
      {rows.length ? <>
        <div className="report-desktop-only"><ReportTable headers={["Date", "Description", "Category", "Location", "Asset / Maintenance", "Amount"]}>
          {rows.map((row) => <tr key={row.id}><td>{formatCompactDate(row.expenseDate)}</td><td>{row.description}</td><td>{labelEnum(row.category)}</td><td>{row.location}</td><td>{row.assetName ?? row.maintenanceTitle ?? "—"}</td><td className="report-strong-cell">{formatVnd(row.amountVnd)}</td></tr>)}
        </ReportTable></div>
        <div className="report-mobile-list">{rows.map((row) => <article className="report-mobile-card" key={row.id}><div><strong>{row.description}</strong><b>{formatVnd(row.amountVnd)}</b></div><span>{formatCompactDate(row.expenseDate)} · {labelEnum(row.category)}</span><small>{row.location}{row.assetName || row.maintenanceTitle ? ` · ${row.assetName ?? row.maintenanceTitle}` : ""}</small></article>)}</div>
      </> : <ReportEmpty icon={WalletCards} title="No expenses recorded in this view" text="There are no owner costs matching these filters." />}
    </section>
  );
}

function OccupancyReport({ view }: { view: ReportsProjection }) {
  const data = view.occupancy;
  return (
    <section className="report-panel" role="tabpanel">
      <div className="report-summary-grid five-up">
        <MetricCard label="Occupancy rate" value={`${data.summary.occupancyRate.toFixed(1)}%`} icon={Home} />
        <MetricCard label="Occupied room-days" value={String(data.summary.occupiedRoomDays)} icon={Building2} />
        <MetricCard label="Vacant room-days" value={String(data.summary.vacantRoomDays)} icon={Home} />
        <MetricCard label="Move-ins" value={String(data.summary.moveIns)} icon={Users} />
        <MetricCard label="Move-outs" value={String(data.summary.moveOuts)} icon={Users} />
      </div>
      <article className="analytics-card report-chart-card"><SectionHeading kicker={`${view.year}`} title="Monthly occupancy rate" /><OccupancyTrendChart points={data.monthly} /></article>
      <ReportTable headers={["Room", "Occupancy", "Occupied days", "Vacant days"]}>
        {data.roomBreakdown.map((row) => <tr key={row.spaceId}><td>{row.room}</td><td><strong>{row.occupancyRate.toFixed(1)}%</strong></td><td>{row.occupiedDays}</td><td>{row.vacantDays}</td></tr>)}
      </ReportTable>
    </section>
  );
}

function UtilitiesReport({ view }: { view: ReportsProjection }) {
  const data = view.utilities;
  return (
    <section className="report-panel" role="tabpanel">
      <div className="utilities-report-grid">
        <article className="analytics-card utility-report-section">
          <SectionHeading kicker="Electricity" title="Tenant-attributable usage" />
          <div className="utility-report-hero"><Zap /><div><strong>{data.electricity.totalTenantKwh} kWh</strong><span>{formatVnd(data.electricity.totalChargeVnd)} finalized charges</span></div></div>
          <p className="report-helper">Uses finalized Phase 3 electricity attribution. Vacant usage is not assigned to tenants.</p>
          <ReportTable embedded headers={["Month", "Usage", "Charge"]}>{data.electricity.monthly.map((row) => <tr key={row.month}><td>{row.label}</td><td>{row.tenantKwh} kWh</td><td>{formatVnd(row.chargeVnd)}</td></tr>)}</ReportTable>
        </article>
        <article className="analytics-card utility-report-section">
          <SectionHeading kicker="Water" title="Fixed-per-occupant billing" />
          <div className="utility-report-hero"><Droplets /><div><strong>{formatVnd(data.water.totalChargeVnd)}</strong><span>{data.water.totalBillablePeople} billed person-month entries</span></div></div>
          <p className="report-helper">Water is not represented as measured consumption; this follows the current fixed-per-occupant billing semantics.</p>
          <ReportTable embedded headers={["Month", "Billable people", "Charge"]}>{data.water.monthly.map((row) => <tr key={row.month}><td>{row.label}</td><td>{row.billablePeople}</td><td>{formatVnd(row.chargeVnd)}</td></tr>)}</ReportTable>
        </article>
      </div>
      {data.electricity.rooms.length ? <ReportTable headers={["Room", "Tenant-attributable electricity", "Finalized charge"]}>{data.electricity.rooms.map((row) => <tr key={row.room}><td>{row.room}</td><td>{row.tenantKwh} kWh</td><td>{formatVnd(row.chargeVnd)}</td></tr>)}</ReportTable> : <ReportEmpty icon={Zap} title="No utility usage available" text="No finalized electricity usage is available for this year." />}
    </section>
  );
}

function DepositsReport({ view }: { view: ReportsProjection }) {
  const data = view.deposits;
  return (
    <section className="report-panel" role="tabpanel">
      <div className="report-summary-grid deposit-summary-grid">
        <MetricMoneyCard label="Expected" value={data.summary.expectedVnd} icon={ShieldCheck} />
        <MetricMoneyCard label="Received" value={data.summary.receivedVnd} icon={Banknote} />
        <MetricMoneyCard label="Currently held" value={data.summary.heldVnd} icon={Coins} />
        <MetricMoneyCard label="Refunded" value={data.summary.refundedVnd} icon={WalletCards} />
        <MetricMoneyCard label="Deductions" value={data.summary.deductedVnd} icon={ReceiptText} />
        <MetricMoneyCard label="Applied" value={data.summary.appliedVnd} icon={Banknote} />
      </div>
      <p className="report-helper report-helper-block">Deposits remain separate from revenue. Expected and held are current positions; received, refunded, deductions, and applied values reflect the selected year.</p>
      {data.rows.length ? <>
        <div className="report-desktop-only"><ReportTable headers={["Tenant / Tenancy", "Room", "Expected", "Received", "Held", "Refunded", "Deducted", "Applied"]}>
          {data.rows.map((row) => <tr key={row.tenancyId}><td>{row.tenantName}</td><td>{row.room}</td><td>{formatVnd(row.expectedVnd)}</td><td>{formatVnd(row.receivedVnd)}</td><td className="report-strong-cell">{formatVnd(row.heldVnd)}</td><td>{formatVnd(row.refundedVnd)}</td><td>{formatVnd(row.deductedVnd)}</td><td>{formatVnd(row.appliedVnd)}</td></tr>)}
        </ReportTable></div>
        <div className="report-mobile-list">{data.rows.map((row) => <article className="report-mobile-card" key={row.tenancyId}><div><strong>{row.tenantName} · {row.room}</strong><b>{formatVnd(row.heldVnd)} held</b></div><dl><div><dt>Expected</dt><dd>{formatVnd(row.expectedVnd)}</dd></div><div><dt>Received</dt><dd>{formatVnd(row.receivedVnd)}</dd></div><div><dt>Refunded</dt><dd>{formatVnd(row.refundedVnd)}</dd></div><div><dt>Applied</dt><dd>{formatVnd(row.appliedVnd)}</dd></div></dl></article>)}</div>
      </> : <ReportEmpty icon={ShieldCheck} title="No deposit activity recorded" text="Deposit ledger activity will appear here when available." />}
    </section>
  );
}

function ReportMoneyCards({ cards }: { cards: Array<{ label: string; value: string; icon: LucideIcon }> }) {
  return <div className={`report-summary-grid ${cards.length === 3 ? "three-up" : ""}`}>{cards.map((card) => <MetricMoneyCard key={card.label} {...card} />)}</div>;
}

function MetricMoneyCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return <article className="analytics-summary-card report-summary-card"><span className="analytics-summary-icon"><Icon /></span><div><span>{label}</span><strong>{formatVnd(value)}</strong></div></article>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return <article className="analytics-summary-card report-summary-card"><span className="analytics-summary-icon"><Icon /></span><div><span>{label}</span><strong>{value}</strong></div></article>;
}


function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return <div className="analytics-card-heading"><div><span className="analytics-section-kicker">{kicker}</span><h2>{title}</h2></div></div>;
}

function Definition({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="report-definition"><span><Icon /></span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function ReportTable({ headers, children, embedded = false }: { headers: string[]; children: React.ReactNode; embedded?: boolean }) {
  return <div className={`report-table-wrap${embedded ? " is-embedded" : ""}`}><table className="report-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`report-status status-${value.toLowerCase()}`}>{labelEnum(value)}</span>;
}

function ReportEmpty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="analytics-empty report-empty"><Icon /><strong>{title}</strong><span>{text}</span></div>;
}

function labelEnum(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}
