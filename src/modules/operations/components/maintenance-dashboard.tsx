"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle2,
  Clock3,
  Flame,
  Search,
  Wrench,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatVndLocale } from "@/i18n/format";

import type { MaintenancePageView } from "../domain/types";
import { MaintenanceDetailDialog, MaintenanceFormDialog } from "./operation-dialogs";
import {
  OperationsEmptyState,
  OperationsPriorityBadge,
  OperationsStatusBadge,
} from "./operations-ui";

export function MaintenanceDashboard({
  propertyId,
  view,
  initialSpaceId = "ALL",
  initialSearch = "",
  initialIssueId = null,
}: {
  propertyId: string;
  view: MaintenancePageView;
  initialSpaceId?: string;
  initialSearch?: string;
  initialIssueId?: string | null;
}) {
  const t = useTranslations("operations");
  const locale = useLocale() as AppLocale;
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState("ACTIVE");
  const [priority, setPriority] = React.useState("ALL");
  const [spaceId, setSpaceId] = React.useState(initialSpaceId);
  const initialIssue = initialIssueId
    ? view.items.find((item) => item.id === initialIssueId) ?? null
    : null;

  const items = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return view.items.filter((item) => {
      if (status === "ACTIVE" && item.status === "COMPLETED") return false;
      if (status !== "ALL" && status !== "ACTIVE" && item.status !== status) return false;
      if (priority !== "ALL" && item.priority !== priority) return false;
      if (spaceId !== "ALL" && item.spaceId !== spaceId) return false;
      if (
        normalized &&
        !`${item.title} ${item.description} ${maintenanceLocationLabel(item, t("property"))} ${item.assignedTo ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
        return false;
      return true;
    });
  }, [priority, search, spaceId, status, t, view.items]);

  return (
    <>
      {initialIssue && (
        <MaintenanceDetailDialog
          propertyId={propertyId}
          issue={initialIssue}
          locations={view.locations}
          assetOptions={view.assetOptions}
          autoOpen
          suppressTrigger
        />
      )}
      <header className="operations-header">
        <div className="operations-header-copy">
          <p className="operations-eyebrow">{t("propertyOperations")}</p>
          <h1>{t("maintenance")}</h1>
          <p>{t("maintenanceSubtitle")}</p>
        </div>
        <MaintenanceFormDialog
          propertyId={propertyId}
          locations={view.locations}
          assetOptions={view.assetOptions}
        />
      </header>

      <section className="operations-summary-grid" aria-label={t("maintenanceSummary")}>
        <SummaryCard
          icon={<Wrench />}
          label={t("open")}
          value={view.summary.open}
          insight={t("waitingToStart")}
          active={status === "OPEN"}
          onClick={() => setStatus(status === "OPEN" ? "ACTIVE" : "OPEN")}
        />
        <SummaryCard
          icon={<Clock3 />}
          label={t("inProgress")}
          value={view.summary.inProgress}
          insight={t("workUnderway")}
          active={status === "IN_PROGRESS"}
          onClick={() => setStatus(status === "IN_PROGRESS" ? "ACTIVE" : "IN_PROGRESS")}
        />
        <SummaryCard
          icon={<Flame />}
          label={t("urgent")}
          value={view.summary.urgent}
          insight={t("needsImmediateAttention")}
          tone="danger"
          active={priority === "URGENT"}
          onClick={() => setPriority(priority === "URGENT" ? "ALL" : "URGENT")}
        />
        <SummaryCard
          icon={<CheckCircle2 />}
          label={t("completedThisMonth")}
          value={view.summary.completedThisMonth}
          insight={t("resolvedOperationalIssues")}
          active={status === "COMPLETED"}
          onClick={() => setStatus(status === "COMPLETED" ? "ACTIVE" : "COMPLETED")}
        />
      </section>

      <section className="operations-panel operations-list-panel">
        <div className="operations-panel-header operations-list-toolbar">
          <div>
            <h2>{t("maintenanceQueue")}</h2>
            <p>{t("maintenanceQueueSubtitle")}</p>
          </div>
          <div className="operations-count-pill">{t("shownCount", { count: items.length })}</div>
        </div>
        <div className="operations-filters">
          <label className="operations-search">
            <Search aria-hidden="true" />
            <span className="sr-only">{t("searchMaintenance")}</span>
            <Input
              type="search"
              placeholder={t("searchIssuePlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t("statusFilter")}>
            <option value="ACTIVE">{t("activeIssues")}</option>
            <option value="ALL">{t("allStatuses")}</option>
            <option value="OPEN">{t("open")}</option>
            <option value="IN_PROGRESS">{t("inProgress")}</option>
            <option value="COMPLETED">{t("completed")}</option>
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label={t("priorityFilter")}>
            <option value="ALL">{t("allPriorities")}</option>
            <option value="URGENT">{t("urgent")}</option>
            <option value="HIGH">{t("high")}</option>
            <option value="MEDIUM">{t("medium")}</option>
            <option value="LOW">{t("low")}</option>
          </select>
          <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} aria-label={t("locationFilter")}>
            <option value="ALL">{t("allLocations")}</option>
            {view.locations.map((location) => (
              <option key={location.spaceId} value={location.spaceId}>
                {location.spaceName} · {location.floorName}
              </option>
            ))}
          </select>
        </div>

        {items.length ? (
          <>
            <div className="operations-table-wrap operations-desktop-table">
              <table className="operations-table maintenance-table">
                <thead>
                  <tr>
                    <th>{t("issue")}</th>
                    <th>{t("location")}</th>
                    <th>{t("priority")}</th>
                    <th>{t("status")}</th>
                    <th>{t("reported")}</th>
                    <th>{t("assigned")}</th>
                    <th>{t("cost")}</th>
                    <th><span className="sr-only">{t("actions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="operations-issue-cell">
                          <strong>{item.title}</strong>
                          <span>{item.description}</span>
                          {item.assetName && <small>{t("assetContext", { name: item.assetName })}</small>}
                          {item.photoCount > 0 && <small>{t("photoCount", { count: item.photoCount })}</small>}
                        </div>
                      </td>
                      <td>
                        <strong className="operations-location">{item.spaceName || item.floorName || t("property")}</strong>
                        {item.spaceName && item.floorName && <span className="operations-subtle">{item.floorName}</span>}
                      </td>
                      <td><OperationsPriorityBadge priority={item.priority} /></td>
                      <td><OperationsStatusBadge status={item.status} /></td>
                      <td>{formatDateOnlyLocale(item.reportedAt, locale)}</td>
                      <td>{item.assignedTo || <span className="operations-muted">{t("unassigned")}</span>}</td>
                      <td>{item.costVnd !== "0" ? formatVndLocale(item.costVnd, locale) : <span className="operations-muted">—</span>}</td>
                      <td>
                        <MaintenanceDetailDialog
                          propertyId={propertyId}
                          issue={item}
                          locations={view.locations}
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
                      <strong>{item.title}</strong>
                      <span>{maintenanceLocationLabel(item, t("property"))}</span>
                    </div>
                    <OperationsStatusBadge status={item.status} />
                  </div>
                  <p>{item.description}</p>
                  {item.assetName && <span className="operations-context-label">{t("assetContext", { name: item.assetName })}</span>}
                  <div className="operations-mobile-meta">
                    <OperationsPriorityBadge priority={item.priority} />
                    <span>{formatDateOnlyLocale(item.reportedAt, locale)}</span>
                    <span>{item.assignedTo || t("unassigned")}</span>
                  </div>
                  <MaintenanceDetailDialog
                    propertyId={propertyId}
                    issue={item}
                    locations={view.locations}
                    assetOptions={view.assetOptions}
                  />
                </article>
              ))}
            </div>
          </>
        ) : (
          <OperationsEmptyState
            icon={view.items.length ? Search : Wrench}
            title={view.items.length ? t("noIssuesMatch") : t("noOpenMaintenance")}
            description={view.items.length ? t("adjustMaintenanceFilters") : t("maintenanceClear")}
            action={
              !view.items.length ? (
                <MaintenanceFormDialog propertyId={propertyId} locations={view.locations} assetOptions={view.assetOptions} />
              ) : undefined
            }
          />
        )}
      </section>
    </>
  );
}


function maintenanceLocationLabel(
  item: MaintenancePageView["items"][number],
  propertyLabel: string,
) {
  if (item.spaceName) return item.floorName ? `${item.spaceName} · ${item.floorName}` : item.spaceName;
  return item.floorName || propertyLabel;
}

function SummaryCard({
  icon,
  label,
  value,
  insight,
  tone = "brand",
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  insight: string;
  tone?: "brand" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`operations-summary-card is-${tone}${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="operations-summary-icon">{icon}</span>
      <span className="operations-summary-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{insight}</small>
      </span>
    </button>
  );
}
