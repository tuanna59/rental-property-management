"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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

import type { AppLocale } from "@/i18n/config";
import {
  formatDateOnlyLocale,
  formatMonthLocale,
  formatNumberLocale,
  formatPercentLocale,
  formatVndLocale,
} from "@/i18n/format";
import type { ReportsProjection, RevenueReportRow } from "../domain/types";
import { ExpenseCategoryBars, FinancialTrendChart, OccupancyTrendChart } from "./analytics-charts";
import "./analytics.css";

type ReportTab = "financial" | "revenue" | "expenses" | "occupancy" | "utilities" | "deposits";

const tabs: Array<{ value: ReportTab; key: `tabs.${ReportTab}` }> = [
  { value: "financial", key: "tabs.financial" },
  { value: "revenue", key: "tabs.revenue" },
  { value: "expenses", key: "tabs.expenses" },
  { value: "occupancy", key: "tabs.occupancy" },
  { value: "utilities", key: "tabs.utilities" },
  { value: "deposits", key: "tabs.deposits" },
];

export function ReportsView({ view, initialTab }: { view: ReportsProjection; initialTab: ReportTab }) {
  const t = useTranslations("reports");
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
          <p className="analytics-eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <label className="reports-year-control">
          <span>{t("year")}</span>
          <select value={view.year} onChange={(event) => updateQuery({ year: Number(event.target.value) })}>
            {view.availableYears.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
        </label>
      </header>

      <div className="reports-tabs" role="tablist" aria-label={t("title")}>
        {tabs.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? "is-active" : undefined} onClick={() => changeTab(item.value)}>
            {t(item.key)}
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
  const t = useTranslations("reports");
  const locale = useLocale() as AppLocale;
  const data = view.financial;
  const chartLabels = {
    billed: t("charts.billed"),
    collected: t("charts.collected"),
    expenses: t("charts.expenses"),
    ariaLabel: t("charts.financialTrendAria"),
  };
  return (
    <section className="report-panel" role="tabpanel">
      <ReportMoneyCards cards={[
        { label: t("financial.billedRevenue"), value: data.summary.billedVnd, icon: ReceiptText },
        { label: t("financial.cashCollected"), value: data.summary.collectedVnd, icon: Banknote },
        { label: t("financial.expenses"), value: data.summary.expensesVnd, icon: WalletCards },
        { label: t("financial.netCash"), value: data.summary.netCashVnd, icon: Coins },
      ]} />
      {data.monthly.every((row) => row.billedVnd === "0" && row.collectedVnd === "0" && row.expensesVnd === "0") && (
        <div className="report-no-data-note">{t("financial.noData", { year: view.year })}</div>
      )}
      <div className="reports-two-column">
        <article className="analytics-card report-chart-card">
          <SectionHeading kicker={`${view.year}`} title={t("financial.monthlyActivity")} />
          <FinancialTrendChart points={data.monthly} locale={locale} labels={chartLabels} showYearOnAxis={false} />
        </article>
        <article className="analytics-card report-definition-card">
          <SectionHeading kicker={t("financial.semantics")} title={t("financial.meaningTitle")} />
          <Definition icon={ReceiptText} title={t("common.billed")} text={t("financial.billedDefinition")} />
          <Definition icon={Banknote} title={t("common.collected")} text={t("financial.collectedDefinition")} />
          <Definition icon={WalletCards} title={t("common.expenses")} text={t("financial.expensesDefinition")} />
          <Definition icon={Coins} title={t("common.netCash")} text={t("financial.netCashDefinition")} />
        </article>
      </div>
      <ReportTable headers={[t("common.month"), t("common.billed"), t("common.collected"), t("common.expenses"), t("common.netCash")]}>
        {data.monthly.map((row) => <tr key={row.month}><td>{formatMonthLocale(row.month, locale)}</td><td>{formatVndLocale(row.billedVnd, locale)}</td><td>{formatVndLocale(row.collectedVnd, locale)}</td><td>{formatVndLocale(row.expensesVnd, locale)}</td><td className="report-strong-cell">{formatVndLocale(row.netCashVnd, locale)}</td></tr>)}
      </ReportTable>
    </section>
  );
}

function RevenueReport({ view }: { view: ReportsProjection }) {
  const t = useTranslations("reports");
  const locale = useLocale() as AppLocale;
  const data = view.revenue;
  const [search, setSearch] = React.useState("");
  const rows = data.rows.filter((row) => `${row.room} ${row.tenantName}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="report-panel" role="tabpanel">
      <ReportMoneyCards cards={[
        { label: t("common.billed"), value: data.summary.billedVnd, icon: ReceiptText },
        { label: t("common.paid"), value: data.summary.paidVnd, icon: Banknote },
        { label: t("common.outstanding"), value: data.summary.outstandingVnd, icon: WalletCards },
      ]} />
      <div className="report-filter-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("revenue.searchPlaceholder")} aria-label={t("revenue.searchAria")} /></div>
      {rows.length ? <>
        <div className="report-desktop-only"><ReportTable headers={[t("revenue.billingPeriod"), t("common.room"), t("revenue.responsibleTenant"), t("revenue.invoice"), t("common.billed"), t("common.paid"), t("common.outstanding"), t("common.status")]}>
          {rows.map((row) => <tr key={row.id}><td>{formatMonthLocale(row.billingPeriod.slice(0, 7), locale)}</td><td>{row.room}</td><td>{row.tenantName}</td><td><Link className="analytics-inline-link" href={row.href}>INV-{row.id.slice(-6).toUpperCase()}</Link></td><td>{formatVndLocale(row.billedVnd, locale)}</td><td>{formatVndLocale(row.paidVnd, locale)}</td><td>{formatVndLocale(row.outstandingVnd, locale)}</td><td><StatusPill value={row.paymentStatus} /></td></tr>)}
        </ReportTable></div>
        <div className="report-mobile-list">{rows.map((row) => <Link href={row.href} className="report-mobile-card" key={row.id}><div><strong>{row.tenantName} · {row.room}</strong><StatusPill value={row.paymentStatus} /></div><span>{formatMonthLocale(row.billingPeriod.slice(0, 7), locale)} · INV-{row.id.slice(-6).toUpperCase()}</span><dl><div><dt>{t("common.billed")}</dt><dd>{formatVndLocale(row.billedVnd, locale)}</dd></div><div><dt>{t("common.paid")}</dt><dd>{formatVndLocale(row.paidVnd, locale)}</dd></div><div><dt>{t("common.outstanding")}</dt><dd>{formatVndLocale(row.outstandingVnd, locale)}</dd></div></dl></Link>)}</div>
      </> : <ReportEmpty icon={ReceiptText} title={t("revenue.noDataTitle")} text={t("revenue.noDataText")} />}
    </section>
  );
}

function ExpenseReport({ view }: { view: ReportsProjection }) {
  const t = useTranslations("reports");
  const locale = useLocale() as AppLocale;
  const data = view.expenses;
  const [category, setCategory] = React.useState("ALL");
  const [location, setLocation] = React.useState("ALL");
  const rows = data.rows.filter((row) => (category === "ALL" || row.category === category) && (location === "ALL" || row.location === location));
  const categories = Array.from(new Set(data.rows.map((row) => row.category)));
  const locations = Array.from(new Set(data.rows.map((row) => row.location))).sort();
  const labelCategory = (value: string) => {
    switch (value) {
      case "REPAIR": return t("expenses.category.REPAIR");
      case "UTILITIES": return t("expenses.category.UTILITIES");
      case "CLEANING": return t("expenses.category.CLEANING");
      case "SUPPLIES": return t("expenses.category.SUPPLIES");
      case "OTHER": return t("expenses.category.OTHER");
      default: return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
    }
  };
  const chartLabels = {
    billed: t("charts.billed"),
    collected: t("charts.collected"),
    expenses: t("charts.expenses"),
    ariaLabel: t("charts.financialTrendAria"),
  };
  return (
    <section className="report-panel" role="tabpanel">
      <ReportMoneyCards cards={[
        { label: t("expenses.total"), value: data.summary.totalVnd, icon: WalletCards },
        { label: t("expenses.repair"), value: data.summary.repairVnd, icon: Gauge },
        { label: t("expenses.utilities"), value: data.summary.utilitiesVnd, icon: Zap },
        { label: t("expenses.otherOperations"), value: data.summary.otherVnd, icon: ReceiptText },
      ]} />
      <div className="reports-two-column">
        <article className="analytics-card report-chart-card"><SectionHeading kicker={`${view.year}`} title={t("expenses.byMonth")} /><FinancialTrendChart points={data.monthly.map((row) => ({ month: row.month, label: row.label, billedVnd: "0", collectedVnd: "0", expensesVnd: row.amountVnd }))} locale={locale} labels={chartLabels} showYearOnAxis={false} /></article>
        <article className="analytics-card report-chart-card"><SectionHeading kicker={t("expenses.categories")} title={t("expenses.mix")} /><ExpenseCategoryBars points={data.categoryBreakdown} locale={locale} labelForCategory={labelCategory} emptyText={t("charts.noExpenses")} /></article>
      </div>
      <div className="report-filter-row report-filter-multiple"><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("expenses.categoryAria")}><option value="ALL">{t("expenses.allCategories")}</option>{categories.map((value) => <option value={value} key={value}>{labelCategory(value)}</option>)}</select><select value={location} onChange={(event) => setLocation(event.target.value)} aria-label={t("expenses.locationAria")}><option value="ALL">{t("expenses.allLocations")}</option>{locations.map((value) => <option value={value} key={value}>{value}</option>)}</select></div>
      {rows.length ? <>
        <div className="report-desktop-only"><ReportTable headers={[t("common.date"), t("common.description"), t("common.category"), t("common.location"), t("expenses.assetMaintenance"), t("common.amount")]}>
          {rows.map((row) => <tr key={row.id}><td>{formatDateOnlyLocale(row.expenseDate, locale)}</td><td>{row.description}</td><td>{labelCategory(row.category)}</td><td>{row.location}</td><td>{row.assetName ?? row.maintenanceTitle ?? "—"}</td><td className="report-strong-cell">{formatVndLocale(row.amountVnd, locale)}</td></tr>)}
        </ReportTable></div>
        <div className="report-mobile-list">{rows.map((row) => <article className="report-mobile-card" key={row.id}><div><strong>{row.description}</strong><b>{formatVndLocale(row.amountVnd, locale)}</b></div><span>{formatDateOnlyLocale(row.expenseDate, locale)} · {labelCategory(row.category)}</span><small>{row.location}{row.assetName || row.maintenanceTitle ? ` · ${row.assetName ?? row.maintenanceTitle}` : ""}</small></article>)}</div>
      </> : <ReportEmpty icon={WalletCards} title={t("expenses.noDataTitle")} text={t("expenses.noDataText")} />}
    </section>
  );
}

function OccupancyReport({ view }: { view: ReportsProjection }) {
  const t = useTranslations("reports");
  const locale = useLocale() as AppLocale;
  const data = view.occupancy;
  return (
    <section className="report-panel" role="tabpanel">
      <div className="report-summary-grid five-up">
        <MetricCard label={t("occupancy.rate")} value={formatPercentLocale(data.summary.occupancyRate, locale)} icon={Home} />
        <MetricCard label={t("occupancy.occupiedRoomDays")} value={formatNumberLocale(data.summary.occupiedRoomDays, locale)} icon={Building2} />
        <MetricCard label={t("occupancy.vacantRoomDays")} value={formatNumberLocale(data.summary.vacantRoomDays, locale)} icon={Home} />
        <MetricCard label={t("occupancy.moveIns")} value={formatNumberLocale(data.summary.moveIns, locale)} icon={Users} />
        <MetricCard label={t("occupancy.moveOuts")} value={formatNumberLocale(data.summary.moveOuts, locale)} icon={Users} />
      </div>
      <article className="analytics-card report-chart-card"><SectionHeading kicker={`${view.year}`} title={t("occupancy.monthlyRate")} /><OccupancyTrendChart points={data.monthly} locale={locale} ariaLabel={t("occupancy.chartAria")} /></article>
      <ReportTable headers={[t("common.room"), t("tabs.occupancy"), t("occupancy.occupiedDays"), t("occupancy.vacantDays")]}>
        {data.roomBreakdown.map((row) => <tr key={row.spaceId}><td>{row.room}</td><td><strong>{formatPercentLocale(row.occupancyRate, locale)}</strong></td><td>{formatNumberLocale(row.occupiedDays, locale)}</td><td>{formatNumberLocale(row.vacantDays, locale)}</td></tr>)}
      </ReportTable>
    </section>
  );
}

function UtilitiesReport({ view }: { view: ReportsProjection }) {
  const t = useTranslations("reports");
  const locale = useLocale() as AppLocale;
  const data = view.utilities;
  return (
    <section className="report-panel" role="tabpanel">
      <div className="utilities-report-grid">
        <article className="analytics-card utility-report-section">
          <SectionHeading kicker={t("utilities.electricity")} title={t("utilities.tenantUsage")} />
          <div className="utility-report-hero"><Zap /><div><strong>{formatNumberLocale(data.electricity.totalTenantKwh, locale, { maximumFractionDigits: 2 })} kWh</strong><span>{t("utilities.finalizedCharges", { amount: formatVndLocale(data.electricity.totalChargeVnd, locale) })}</span></div></div>
          <p className="report-helper">{t("utilities.electricityHelper")}</p>
          <ReportTable embedded headers={[t("common.month"), t("common.usage"), t("common.charge")]}>{data.electricity.monthly.map((row) => <tr key={row.month}><td>{formatMonthLocale(row.month, locale)}</td><td>{formatNumberLocale(row.tenantKwh, locale, { maximumFractionDigits: 2 })} kWh</td><td>{formatVndLocale(row.chargeVnd, locale)}</td></tr>)}</ReportTable>
        </article>
        <article className="analytics-card utility-report-section">
          <SectionHeading kicker={t("utilities.water")} title={t("utilities.fixedBilling")} />
          <div className="utility-report-hero"><Droplets /><div><strong>{formatVndLocale(data.water.totalChargeVnd, locale)}</strong><span>{t("utilities.personMonthEntries", { count: data.water.totalBillablePeople })}</span></div></div>
          <p className="report-helper">{t("utilities.waterHelper")}</p>
          <ReportTable embedded headers={[t("common.month"), t("utilities.billablePeople"), t("common.charge")]}>{data.water.monthly.map((row) => <tr key={row.month}><td>{formatMonthLocale(row.month, locale)}</td><td>{formatNumberLocale(row.billablePeople, locale)}</td><td>{formatVndLocale(row.chargeVnd, locale)}</td></tr>)}</ReportTable>
        </article>
      </div>
      {data.electricity.rooms.length ? <ReportTable headers={[t("common.room"), t("utilities.tenantElectricity"), t("utilities.finalizedCharge")]}>{data.electricity.rooms.map((row) => <tr key={row.room}><td>{row.room}</td><td>{formatNumberLocale(row.tenantKwh, locale, { maximumFractionDigits: 2 })} kWh</td><td>{formatVndLocale(row.chargeVnd, locale)}</td></tr>)}</ReportTable> : <ReportEmpty icon={Zap} title={t("utilities.noDataTitle")} text={t("utilities.noDataText")} />}
    </section>
  );
}

function DepositsReport({ view }: { view: ReportsProjection }) {
  const t = useTranslations("reports");
  const locale = useLocale() as AppLocale;
  const data = view.deposits;
  return (
    <section className="report-panel" role="tabpanel">
      <div className="report-summary-grid deposit-summary-grid">
        <MetricMoneyCard label={t("deposits.expected")} value={data.summary.expectedVnd} icon={ShieldCheck} />
        <MetricMoneyCard label={t("deposits.received")} value={data.summary.receivedVnd} icon={Banknote} />
        <MetricMoneyCard label={t("deposits.currentlyHeld")} value={data.summary.heldVnd} icon={Coins} />
        <MetricMoneyCard label={t("deposits.refunded")} value={data.summary.refundedVnd} icon={WalletCards} />
        <MetricMoneyCard label={t("deposits.deductions")} value={data.summary.deductedVnd} icon={ReceiptText} />
        <MetricMoneyCard label={t("deposits.applied")} value={data.summary.appliedVnd} icon={Banknote} />
      </div>
      <p className="report-helper report-helper-block">{t("deposits.helper")}</p>
      {data.rows.length ? <>
        <div className="report-desktop-only"><ReportTable headers={[t("deposits.tenantTenancy"), t("common.room"), t("deposits.expected"), t("deposits.received"), t("deposits.held"), t("deposits.refunded"), t("deposits.deducted"), t("deposits.applied")]}>
          {data.rows.map((row) => <tr key={row.tenancyId}><td>{row.tenantName}</td><td>{row.room}</td><td>{formatVndLocale(row.expectedVnd, locale)}</td><td>{formatVndLocale(row.receivedVnd, locale)}</td><td className="report-strong-cell">{formatVndLocale(row.heldVnd, locale)}</td><td>{formatVndLocale(row.refundedVnd, locale)}</td><td>{formatVndLocale(row.deductedVnd, locale)}</td><td>{formatVndLocale(row.appliedVnd, locale)}</td></tr>)}
        </ReportTable></div>
        <div className="report-mobile-list">{data.rows.map((row) => <article className="report-mobile-card" key={row.tenancyId}><div><strong>{row.tenantName} · {row.room}</strong><b>{formatVndLocale(row.heldVnd, locale)} {t("deposits.heldSuffix")}</b></div><dl><div><dt>{t("deposits.expected")}</dt><dd>{formatVndLocale(row.expectedVnd, locale)}</dd></div><div><dt>{t("deposits.received")}</dt><dd>{formatVndLocale(row.receivedVnd, locale)}</dd></div><div><dt>{t("deposits.refunded")}</dt><dd>{formatVndLocale(row.refundedVnd, locale)}</dd></div><div><dt>{t("deposits.applied")}</dt><dd>{formatVndLocale(row.appliedVnd, locale)}</dd></div></dl></article>)}</div>
      </> : <ReportEmpty icon={ShieldCheck} title={t("deposits.noDataTitle")} text={t("deposits.noDataText")} />}
    </section>
  );
}

function ReportMoneyCards({ cards }: { cards: Array<{ label: string; value: string; icon: LucideIcon }> }) {
  return <div className={`report-summary-grid ${cards.length === 3 ? "three-up" : ""}`}>{cards.map((card) => <MetricMoneyCard key={card.label} {...card} />)}</div>;
}

function MetricMoneyCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  const locale = useLocale() as AppLocale;
  return <article className="analytics-summary-card report-summary-card"><span className="analytics-summary-icon"><Icon /></span><div><span>{label}</span><strong>{formatVndLocale(value, locale)}</strong></div></article>;
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

function StatusPill({ value }: { value: RevenueReportRow["paymentStatus"] }) {
  const t = useTranslations("reports");
  const label = value === "UNPAID" ? t("status.UNPAID") : value === "PARTIAL" ? t("status.PARTIAL") : t("status.PAID");
  return <span className={`report-status status-${value.toLowerCase()}`}>{label}</span>;
}

function ReportEmpty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="analytics-empty report-empty"><Icon /><strong>{title}</strong><span>{text}</span></div>;
}

