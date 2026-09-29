"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CircleDollarSign,
  Hammer,
  ReceiptText,
  Search,
  WalletCards,
  Zap,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthLocale, formatVndLocale } from "@/i18n/format";
import { MonthSelector } from "@/modules/utilities/components/utility-ui";

import type { ExpensePageView } from "../domain/types";
import {
  ExpenseActions,
  ExpenseFormDialog,
  ExpenseReceiptIndicator,
  MaintenanceDetailDialog,
} from "./operation-dialogs";
import { OperationsEmptyState, useOperationsLabels } from "./operations-ui";

export function ExpensesDashboard({
  propertyId,
  view,
  month,
  initialAssetId = null,
}: {
  propertyId: string;
  view: ExpensePageView;
  month: string;
  initialAssetId?: string | null;
}) {
  const t = useTranslations("operations");
  const locale = useLocale() as AppLocale;
  const { categoryLabel } = useOperationsLabels();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("ALL");
  const [location, setLocation] = React.useState("ALL");

  const initialAsset = view.assetOptions.find((asset) => asset.id === initialAssetId) ?? null;

  const maintenanceById = React.useMemo(
    () => new Map(view.maintenanceItems.map((issue) => [issue.id, issue])),
    [view.maintenanceItems],
  );

  const items = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return view.items.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (location !== "ALL" && item.spaceId !== location) return false;
      if (
        normalized &&
        !`${item.description} ${expenseLocationLabel(item.locationLabel, t)} ${item.maintenanceTitle ?? ""} ${item.assetName ?? ""}`
          .toLowerCase()
          .includes(normalized)
      ) return false;
      return true;
    });
  }, [category, location, search, view.items]);

  return (
    <>
      <header className="operations-header">
        <div className="operations-header-copy">
          <p className="operations-eyebrow">{t("propertyOperations")}</p>
          <h1>{t("expenses")}</h1>
          <p>{t("expensesSubtitle")}</p>
        </div>
        <div className="operations-header-actions">
          <MonthSelector month={month} />
          <ExpenseFormDialog
            propertyId={propertyId}
            locations={view.locations}
            maintenanceOptions={view.maintenanceOptions}
            assetOptions={view.assetOptions}
            defaultAssetId={initialAsset?.id ?? null}
            defaultFloorId={initialAsset?.floorId ?? null}
            defaultSpaceId={initialAsset?.spaceId ?? null}
            autoOpen={Boolean(initialAsset)}
          />
        </div>
      </header>

      <section className="operations-summary-grid" aria-label={t("expenseSummary")}>
        <ExpenseSummaryCard icon={<CircleDollarSign />} label={t("totalExpenses")} value={formatVndLocale(view.summary.totalVnd, locale)} insight={t("recordedThisMonth", { count: view.summary.count })} />
        <ExpenseSummaryCard icon={<Hammer />} label={t("repair")} value={formatVndLocale(view.summary.repairVnd, locale)} insight={t("maintenanceRepairCosts")} />
        <ExpenseSummaryCard icon={<Zap />} label={t("utilitiesCategory")} value={formatVndLocale(view.summary.utilitiesVnd, locale)} insight={t("ownerPaidUtilities")} />
        <ExpenseSummaryCard icon={<WalletCards />} label={t("otherOperations")} value={formatVndLocale(view.summary.otherVnd, locale)} insight={t("cleaningSuppliesOther")} />
      </section>

      <section className="operations-panel operations-list-panel">
        <div className="operations-panel-header operations-list-toolbar">
          <div>
            <h2>{t("expenseRegister")}</h2>
            <p>{t("expenseRegisterSubtitle")}</p>
          </div>
          <div className="operations-count-pill">{t("shownCount", { count: items.length })}</div>
        </div>
        <div className="operations-filters operations-expense-filters">
          <label className="operations-search">
            <Search aria-hidden="true" />
            <span className="sr-only">{t("searchExpenses")}</span>
            <Input type="search" placeholder={t("searchExpensePlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("expenseCategoryFilter")}>
            <option value="ALL">{t("allCategories")}</option>
            <option value="REPAIR">{t("repair")}</option>
            <option value="UTILITIES">{t("utilitiesCategory")}</option>
            <option value="CLEANING">{t("cleaning")}</option>
            <option value="SUPPLIES">{t("supplies")}</option>
            <option value="OTHER">{t("other")}</option>
          </select>
          <select value={location} onChange={(event) => setLocation(event.target.value)} aria-label={t("expenseLocationFilter")}>
            <option value="ALL">{t("allLocations")}</option>
            {view.locations.map((item) => <option key={item.spaceId} value={item.spaceId}>{item.spaceName} · {item.floorName}</option>)}
          </select>
        </div>

        {items.length ? (
          <>
            <div className="operations-table-wrap operations-expense-table-wrap operations-desktop-table">
              <table className="operations-table expense-table">
                <thead><tr><th>{t("date")}</th><th>{t("description")}</th><th>{t("category")}</th><th>{t("location")}</th><th>{t("linkedMaintenance")}</th><th>{t("amount")}</th><th>{t("receipt")}</th><th><span className="sr-only">{t("actions")}</span></th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateOnlyLocale(item.expenseDate, locale)}</td>
                      <td><div className="operations-description-cell"><strong>{item.description}</strong>{item.notes && <span>{item.notes}</span>}{item.assetName && item.assetId ? <small><Link className="operations-context-link" href={`/assets/${item.assetId}`}>{t("assetContext", { name: item.assetName })}</Link></small> : item.assetName ? <small>{t("assetContext", { name: item.assetName })}</small> : null}</div></td>
                      <td><span className={`operations-category is-${item.category.toLowerCase()}`}>{categoryLabel(item.category)}</span></td>
                      <td>{expenseLocationLabel(item.locationLabel, t)}</td>
                      <td>{item.maintenanceIssueId && maintenanceById.get(item.maintenanceIssueId) ? <MaintenanceDetailDialog propertyId={propertyId} issue={maintenanceById.get(item.maintenanceIssueId)!} locations={view.locations} assetOptions={view.assetOptions} trigger={<button type="button" className="operations-context-link operations-context-button">{item.maintenanceTitle}</button>} /> : item.maintenanceTitle ? <span className="operations-context-label">{item.maintenanceTitle}</span> : <span className="operations-muted">—</span>}</td>
                      <td><strong className="operations-money">{formatVndLocale(item.amountVnd, locale)}</strong></td>
                      <td><ExpenseReceiptIndicator expense={item} /></td>
                      <td><ExpenseActions propertyId={propertyId} expense={item} locations={view.locations} maintenanceOptions={view.maintenanceOptions} assetOptions={view.assetOptions} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="operations-mobile-list">
              {items.map((item) => (
                <article key={item.id} className="operations-mobile-card">
                  <div className="operations-mobile-card-head"><div><strong>{item.description}</strong><span>{formatDateOnlyLocale(item.expenseDate, locale)} · {expenseLocationLabel(item.locationLabel, t)}</span></div><strong className="operations-money">{formatVndLocale(item.amountVnd, locale)}</strong></div>
                  {item.assetName && item.assetId && <Link className="operations-context-link" href={`/assets/${item.assetId}`}>{t("assetContext", { name: item.assetName })}</Link>}
                  <div className="operations-mobile-meta">
                    <span className={`operations-category is-${item.category.toLowerCase()}`}>{categoryLabel(item.category)}</span>
                    {item.maintenanceIssueId && maintenanceById.get(item.maintenanceIssueId) ? <MaintenanceDetailDialog propertyId={propertyId} issue={maintenanceById.get(item.maintenanceIssueId)!} locations={view.locations} assetOptions={view.assetOptions} trigger={<button type="button" className="operations-context-link operations-context-button">{item.maintenanceTitle}</button>} /> : item.maintenanceTitle ? <span>{item.maintenanceTitle}</span> : null}
                    {item.hasReceipt && <ExpenseReceiptIndicator expense={item} />}
                  </div>
                  <ExpenseActions propertyId={propertyId} expense={item} locations={view.locations} maintenanceOptions={view.maintenanceOptions} assetOptions={view.assetOptions} />
                </article>
              ))}
            </div>
          </>
        ) : (
          <OperationsEmptyState
            icon={view.items.length ? Search : ReceiptText}
            title={view.items.length ? t("noExpensesMatch") : t("noExpensesForMonth", { month: formatMonthLocale(month, locale) })}
            description={view.items.length ? t("adjustExpenseFilters") : t("recordOperatingCosts")}
            action={!view.items.length ? <ExpenseFormDialog propertyId={propertyId} locations={view.locations} maintenanceOptions={view.maintenanceOptions} assetOptions={view.assetOptions} /> : undefined}
          />
        )}
      </section>
    </>
  );
}

function ExpenseSummaryCard({ icon, label, value, insight }: { icon: React.ReactNode; label: string; value: string; insight: string }) {
  return <article className="operations-summary-card is-static"><span className="operations-summary-icon">{icon}</span><span className="operations-summary-copy"><span>{label}</span><strong>{value}</strong><small>{insight}</small></span></article>;
}

function expenseLocationLabel(value: string, t: ReturnType<typeof useTranslations<"operations">>) {
  return value === "Property" ? t("property") : value;
}
