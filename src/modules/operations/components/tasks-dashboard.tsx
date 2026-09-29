"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ListTodo,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/presentation";

import type { TaskPageView } from "../domain/types";
import { TaskActions, TaskFormDialog, TaskRecurrence } from "./operation-dialogs";
import {
  OperationsEmptyState,
  OperationsPriorityBadge,
  OperationsStatusBadge,
} from "./operations-ui";

export function TasksDashboard({
  propertyId,
  view,
}: {
  propertyId: string;
  view: TaskPageView;
}) {
  const [tab, setTab] = React.useState<"DUE" | "UPCOMING" | "COMPLETED">("DUE");
  const [search, setSearch] = React.useState("");
  const [priority, setPriority] = React.useState("ALL");

  const items = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return view.items.filter((item) => {
      if (priority !== "ALL" && item.priority !== priority) return false;
      if (normalized && !`${item.title} ${item.description ?? ""} ${item.linkedLabel ?? ""}`.toLowerCase().includes(normalized)) return false;
      if (tab === "COMPLETED") return item.status === "DONE";
      if (item.status !== "TODO") return false;
      if (tab === "DUE") return Boolean(item.dueDate && item.dueDate <= todayDate);
      return !item.dueDate || item.dueDate > todayDate;
    });
  }, [priority, search, tab, view.items]);

  const nextUpcoming = React.useMemo(() => {
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return view.items
      .filter((item) => item.status === "TODO" && item.dueDate && item.dueDate > todayDate)
      .map((item) => item.dueDate!)
      .sort()[0] ?? null;
  }, [view.items]);

  return (
    <>
      <header className="operations-header">
        <div className="operations-header-copy">
          <p className="operations-eyebrow">PROPERTY OPERATIONS</p>
          <h1>Tasks</h1>
          <p>Track recurring and one-time property work.</p>
        </div>
        <TaskFormDialog
          propertyId={propertyId}
          locations={view.locations}
          maintenanceOptions={view.maintenanceOptions}
          invoiceOptions={view.invoiceOptions}
        />
      </header>

      <section className="operations-summary-grid operations-task-summary-grid" aria-label="Task summary">
        <TaskSummaryCard
          icon={<CircleAlert />}
          label="Due / overdue"
          value={view.summary.dueOrOverdue}
          insight={view.summary.overdue ? `${view.summary.overdue} overdue` : "Nothing overdue"}
          active={tab === "DUE"}
          onClick={() => setTab("DUE")}
        />
        <TaskSummaryCard
          icon={<CalendarClock />}
          label="Upcoming"
          value={view.summary.upcoming}
          insight={nextUpcoming ? `Next due ${formatDate(nextUpcoming)}` : "No upcoming due dates"}
          active={tab === "UPCOMING"}
          onClick={() => setTab("UPCOMING")}
        />
        <TaskSummaryCard
          icon={<CheckCircle2 />}
          label="Completed this month"
          value={view.summary.completedThisMonth}
          insight="Completed occurrences"
          active={tab === "COMPLETED"}
          onClick={() => setTab("COMPLETED")}
        />
      </section>
      <section className="operations-panel operations-task-panel">
        <div className="operations-panel-header operations-task-panel-head">
          <div className="operations-segmented-tabs" role="tablist" aria-label="Task views">
            <button type="button" role="tab" aria-selected={tab === "DUE"} className={tab === "DUE" ? "is-active" : ""} onClick={() => setTab("DUE")}>Due / Overdue</button>
            <button type="button" role="tab" aria-selected={tab === "UPCOMING"} className={tab === "UPCOMING" ? "is-active" : ""} onClick={() => setTab("UPCOMING")}>Upcoming</button>
            <button type="button" role="tab" aria-selected={tab === "COMPLETED"} className={tab === "COMPLETED" ? "is-active" : ""} onClick={() => setTab("COMPLETED")}>Completed</button>
          </div>
          <div className="operations-count-pill">{items.length} shown</div>
        </div>
        <div className="operations-filters operations-task-filters">
          <label className="operations-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search tasks</span>
            <Input
              type="search"
              placeholder="Search task or linked context"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Task priority filter">
            <option value="ALL">All priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {items.length ? (
          <div className="operations-task-list">
            {items.map((task) => (
              <article key={task.id} className={`operations-task-item${task.overdue ? " is-overdue" : ""}${task.status === "DONE" ? " is-done" : ""}`}>
                <div className="operations-task-check">
                  {task.status === "DONE" ? <CheckCircle2 /> : task.overdue ? <CircleAlert /> : <CalendarCheck2 />}
                </div>
                <div className="operations-task-content">
                  <div className="operations-task-title-row">
                    <strong>{task.title}</strong>
                    <OperationsPriorityBadge priority={task.priority} />
                    <OperationsStatusBadge status={task.status} />
                  </div>
                  {task.description && <p>{task.description}</p>}
                  <div className="operations-task-meta">
                    {task.linkedLabel && <TaskContextLink task={task} />}
                    <span className={task.overdue ? "is-overdue" : ""}>
                      {task.dueDate ? `${task.overdue ? "Overdue" : "Due"} ${formatDate(task.dueDate)}` : "No due date"}
                    </span>
                    <TaskRecurrence task={task} />
                  </div>
                </div>
                <TaskActions
                  propertyId={propertyId}
                  task={task}
                  locations={view.locations}
                  maintenanceOptions={view.maintenanceOptions}
                  invoiceOptions={view.invoiceOptions}
                />
              </article>
            ))}
          </div>
        ) : (
          <OperationsEmptyState
            icon={tab === "COMPLETED" ? CheckCircle2 : ListTodo}
            title={view.items.length ? "No tasks in this view" : "No tasks due"}
            description={
              view.items.length
                ? "Try another view, priority, or search term."
                : "You're caught up. Add a one-time or recurring task when work needs tracking."
            }
            action={
              !view.items.length ? (
                <TaskFormDialog
                  propertyId={propertyId}
                  locations={view.locations}
                  maintenanceOptions={view.maintenanceOptions}
                  invoiceOptions={view.invoiceOptions}
                />
              ) : undefined
            }
          />
        )}
      </section>
    </>
  );
}

function TaskSummaryCard({
  icon,
  label,
  value,
  insight,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  insight: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`operations-summary-card${active ? " is-active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
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

function TaskContextLink({ task }: { task: import("../domain/types").TaskListItemView }) {
  if (!task.linkedLabel || !task.linkedEntityType || !task.linkedEntityId) return null;
  const href =
    task.linkedEntityType === "SPACE"
      ? `/building?space=${encodeURIComponent(task.linkedEntityId)}`
      : task.linkedEntityType === "MAINTENANCE"
        ? `/operations/maintenance?search=${encodeURIComponent(task.linkedLabel.split(" · ")[0])}`
        : task.linkedEntityType === "INVOICE"
          ? `/billing/invoices/${task.linkedEntityId}`
          : "/building";
  return <Link className="operations-context-link" href={href}>{task.linkedLabel}</Link>;
}
