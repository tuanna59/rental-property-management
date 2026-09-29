"use client";

import * as React from "react";
import Link from "next/link";
import {
  Banknote,
  CircleDollarSign,
  Hammer,
  ReceiptText,
  Search,
  WalletCards,
  Zap,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatDate, formatVnd } from "@/lib/presentation";
import { MonthSelector } from "@/modules/utilities/components/utility-ui";

import type { ExpensePageView } from "../domain/types";
import {
  ExpenseActions,
  ExpenseFormDialog,
  ExpenseReceiptIndicator,
  MaintenanceDetailDialog,
} from "./operation-dialogs";
import { categoryLabel, OperationsEmptyState } from "./operations-ui";

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
        !`${item.description} ${item.locationLabel} ${item.maintenanceTitle ?? ""} ${item.assetName ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
        return false;
      return true;
    });
  }, [category, location, search, view.items]);

  return (
    <>
      <header className="operations-header">
        <div className="operations-header-copy">
          <p className="operations-eyebrow">PROPERTY OPERATIONS</p>
          <h1>Expenses</h1>
          <p>Track property operating and maintenance costs.</p>
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

      <section className="operations-summary-grid" aria-label="Expense summary">
        <ExpenseSummaryCard
          icon={<CircleDollarSign />}
          label="Total expenses"
          value={formatVnd(view.summary.totalVnd)}
          insight={`${view.summary.count} recorded this month`}
        />
        <ExpenseSummaryCard
          icon={<Hammer />}
          label="Repair"
          value={formatVnd(view.summary.repairVnd)}
          insight="Maintenance and repair costs"
        />
        <ExpenseSummaryCard
          icon={<Zap />}
          label="Utilities"
          value={formatVnd(view.summary.utilitiesVnd)}
          insight="Owner-paid utility costs"
        />
        <ExpenseSummaryCard
          icon={<WalletCards />}
          label="Other operations"
          value={formatVnd(view.summary.otherVnd)}
          insight="Cleaning, supplies, and other"
        />
      </section>

      <section className="operations-panel operations-list-panel">
        <div className="operations-panel-header operations-list-toolbar">
          <div>
            <h2>Expense register</h2>
            <p>Actual owner costs only — separate from tenant billing and payments.</p>
          </div>
          <div className="operations-count-pill">{items.length} shown</div>
        </div>
        <div className="operations-filters operations-expense-filters">
          <label className="operations-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search expenses</span>
            <Input
              type="search"
              placeholder="Search description or location"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Expense category filter">
            <option value="ALL">All categories</option>
            <option value="REPAIR">Repair</option>
            <option value="UTILITIES">Utilities</option>
            <option value="CLEANING">Cleaning</option>
            <option value="SUPPLIES">Supplies</option>
            <option value="OTHER">Other</option>
          </select>
          <select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Expense location filter">
            <option value="ALL">All locations</option>
            {view.locations.map((item) => (
              <option key={item.spaceId} value={item.spaceId}>
                {item.spaceName} · {item.floorName}
              </option>
            ))}
          </select>
        </div>

        {items.length ? (
          <>
            <div className="operations-table-wrap operations-expense-table-wrap operations-desktop-table">
              <table className="operations-table expense-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Linked maintenance</th>
                    <th>Amount</th>
                    <th>Receipt</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.expenseDate)}</td>
                      <td>
                        <div className="operations-description-cell">
                          <strong>{item.description}</strong>
                          {item.notes && <span>{item.notes}</span>}
                          {item.assetName && item.assetId ? <small><Link className="operations-context-link" href={`/assets/${item.assetId}`}>Asset · {item.assetName}</Link></small> : item.assetName ? <small>Asset · {item.assetName}</small> : null}
                        </div>
                      </td>
                      <td><span className={`operations-category is-${item.category.toLowerCase()}`}>{categoryLabel(item.category)}</span></td>
                      <td>{item.locationLabel}</td>
                      <td>
                        {item.maintenanceIssueId && maintenanceById.get(item.maintenanceIssueId) ? (
                          <MaintenanceDetailDialog
                            propertyId={propertyId}
                            issue={maintenanceById.get(item.maintenanceIssueId)!}
                            locations={view.locations}
                            assetOptions={view.assetOptions}
                            trigger={
                              <button type="button" className="operations-context-link operations-context-button">
                                {item.maintenanceTitle}
                              </button>
                            }
                          />
                        ) : item.maintenanceTitle ? (
                          <span className="operations-context-label">{item.maintenanceTitle}</span>
                        ) : (
                          <span className="operations-muted">—</span>
                        )}
                      </td>
                      <td><strong className="operations-money">{formatVnd(item.amountVnd)}</strong></td>
                      <td><ExpenseReceiptIndicator expense={item} /></td>
                      <td>
                        <ExpenseActions
                          propertyId={propertyId}
                          expense={item}
                          locations={view.locations}
                          maintenanceOptions={view.maintenanceOptions}
                          assetOptions={view.assetOptions}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="operations-mobile-list">
              {items.map((item) => (
                <article key={item.id} className="operations-mobile-card">
                  <div className="operations-mobile-card-head">
                    <div>
                      <strong>{item.description}</strong>
                      <span>{formatDate(item.expenseDate)} · {item.locationLabel}</span>
                    </div>
                    <strong className="operations-money">{formatVnd(item.amountVnd)}</strong>
                  </div>
                  {item.assetName && item.assetId && <Link className="operations-context-link" href={`/assets/${item.assetId}`}>Asset · {item.assetName}</Link>}
                  <div className="operations-mobile-meta">
                    <span className={`operations-category is-${item.category.toLowerCase()}`}>{categoryLabel(item.category)}</span>
                    {item.maintenanceIssueId && maintenanceById.get(item.maintenanceIssueId) ? (
                      <MaintenanceDetailDialog
                        propertyId={propertyId}
                        issue={maintenanceById.get(item.maintenanceIssueId)!}
                        locations={view.locations}
                        assetOptions={view.assetOptions}
                        trigger={
                          <button type="button" className="operations-context-link operations-context-button">
                            {item.maintenanceTitle}
                          </button>
                        }
                      />
                    ) : item.maintenanceTitle ? (
                      <span>{item.maintenanceTitle}</span>
                    ) : null}
                    {item.hasReceipt && <ExpenseReceiptIndicator expense={item} />}
                  </div>
                  <ExpenseActions
                    propertyId={propertyId}
                    expense={item}
                    locations={view.locations}
                    maintenanceOptions={view.maintenanceOptions}
                    assetOptions={view.assetOptions}
                  />
                </article>
              ))}
            </div>
          </>
        ) : (
          <OperationsEmptyState
            icon={view.items.length ? Search : ReceiptText}
            title={view.items.length ? "No expenses match these filters" : `No expenses recorded for ${monthLabel(month)}`}
            description={
              view.items.length
                ? "Adjust the search, category, or location filter."
                : "Record operating costs here when the property incurs an actual expense."
            }
            action={
              !view.items.length ? (
                <ExpenseFormDialog
                  propertyId={propertyId}
                  locations={view.locations}
                  maintenanceOptions={view.maintenanceOptions}
                  assetOptions={view.assetOptions}
                />
              ) : undefined
            }
          />
        )}
      </section>
    </>
  );
}

function ExpenseSummaryCard({
  icon,
  label,
  value,
  insight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  insight: string;
}) {
  return (
    <article className="operations-summary-card is-static">
      <span className="operations-summary-icon">{icon}</span>
      <span className="operations-summary-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{insight}</small>
      </span>
    </article>
  );
}

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
}
