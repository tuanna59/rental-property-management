"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flame,
  Search,
  Wrench,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatDate, formatVnd } from "@/lib/presentation";

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
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState("ACTIVE");
  const [priority, setPriority] = React.useState("ALL");
  const [spaceId, setSpaceId] = React.useState(initialSpaceId);
  const initialIssue = initialIssueId ? view.items.find((item) => item.id === initialIssueId) ?? null : null;

  const items = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return view.items.filter((item) => {
      if (
        status === "ACTIVE" &&
        item.status === "COMPLETED"
      )
        return false;
      if (status !== "ALL" && status !== "ACTIVE" && item.status !== status)
        return false;
      if (priority !== "ALL" && item.priority !== priority) return false;
      if (spaceId !== "ALL" && item.spaceId !== spaceId) return false;
      if (
        normalized &&
        !`${item.title} ${item.description} ${item.locationLabel} ${item.assignedTo ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
        return false;
      return true;
    });
  }, [priority, search, spaceId, status, view.items]);

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
          <p className="operations-eyebrow">PROPERTY OPERATIONS</p>
          <h1>Maintenance</h1>
          <p>Track repair and property issues from report to completion.</p>
        </div>
        <MaintenanceFormDialog
          propertyId={propertyId}
          locations={view.locations}
          assetOptions={view.assetOptions}
        />
      </header>

      <section className="operations-summary-grid" aria-label="Maintenance summary">
        <SummaryCard
          icon={<Wrench />}
          label="Open"
          value={view.summary.open}
          insight="Waiting to be started"
          active={status === "OPEN"}
          onClick={() => setStatus(status === "OPEN" ? "ACTIVE" : "OPEN")}
        />
        <SummaryCard
          icon={<Clock3 />}
          label="In progress"
          value={view.summary.inProgress}
          insight="Work currently underway"
          active={status === "IN_PROGRESS"}
          onClick={() =>
            setStatus(status === "IN_PROGRESS" ? "ACTIVE" : "IN_PROGRESS")
          }
        />
        <SummaryCard
          icon={<Flame />}
          label="Urgent"
          value={view.summary.urgent}
          insight="Needs immediate attention"
          tone="danger"
          active={priority === "URGENT"}
          onClick={() => setPriority(priority === "URGENT" ? "ALL" : "URGENT")}
        />
        <SummaryCard
          icon={<CheckCircle2 />}
          label="Completed this month"
          value={view.summary.completedThisMonth}
          insight="Resolved operational issues"
          active={status === "COMPLETED"}
          onClick={() =>
            setStatus(status === "COMPLETED" ? "ACTIVE" : "COMPLETED")
          }
        />
      </section>

      <section className="operations-panel operations-list-panel">
        <div className="operations-panel-header operations-list-toolbar">
          <div>
            <h2>Maintenance queue</h2>
            <p>Focus on current work, then review completed history when needed.</p>
          </div>
          <div className="operations-count-pill">{items.length} shown</div>
        </div>
        <div className="operations-filters">
          <label className="operations-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search maintenance</span>
            <Input
              type="search"
              placeholder="Search issue, location, assignee"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status filter">
            <option value="ACTIVE">Active issues</option>
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Priority filter">
            <option value="ALL">All priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} aria-label="Location filter">
            <option value="ALL">All locations</option>
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
                    <th>Issue</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th>Assigned</th>
                    <th>Cost</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="operations-issue-cell">
                          <strong>{item.title}</strong>
                          <span>{item.description}</span>
                          {item.assetName && <small>Asset · {item.assetName}</small>}
                          {item.photoCount > 0 && <small>{item.photoCount} photo{item.photoCount === 1 ? "" : "s"}</small>}
                        </div>
                      </td>
                      <td>
                        <strong className="operations-location">{item.spaceName || item.floorName || "Property"}</strong>
                        {item.spaceName && item.floorName && <span className="operations-subtle">{item.floorName}</span>}
                      </td>
                      <td><OperationsPriorityBadge priority={item.priority} /></td>
                      <td><OperationsStatusBadge status={item.status} /></td>
                      <td>{formatDate(item.reportedAt)}</td>
                      <td>{item.assignedTo || <span className="operations-muted">Unassigned</span>}</td>
                      <td>{item.costVnd !== "0" ? formatVnd(item.costVnd) : <span className="operations-muted">—</span>}</td>
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
                      <span>{item.locationLabel}</span>
                    </div>
                    <OperationsStatusBadge status={item.status} />
                  </div>
                  <p>{item.description}</p>
                  {item.assetName && <span className="operations-context-label">Asset · {item.assetName}</span>}
                  <div className="operations-mobile-meta">
                    <OperationsPriorityBadge priority={item.priority} />
                    <span>{formatDate(item.reportedAt)}</span>
                    <span>{item.assignedTo || "Unassigned"}</span>
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
            title={view.items.length ? "No issues match these filters" : "No open maintenance issues"}
            description={
              view.items.length
                ? "Adjust search or filters to see more maintenance history."
                : "Property maintenance is currently clear. Report an issue when something needs attention."
            }
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
