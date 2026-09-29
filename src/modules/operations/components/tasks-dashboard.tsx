"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ListTodo,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale } from "@/i18n/format";

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
  const t = useTranslations("operations");
  const locale = useLocale() as AppLocale;
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
          <p className="operations-eyebrow">{t("propertyOperations")}</p>
          <h1>{t("tasks")}</h1>
          <p>{t("tasksSubtitle")}</p>
        </div>
        <TaskFormDialog
          propertyId={propertyId}
          locations={view.locations}
          maintenanceOptions={view.maintenanceOptions}
          invoiceOptions={view.invoiceOptions}
        />
      </header>

      <section className="operations-summary-grid operations-task-summary-grid" aria-label={t("taskSummary")}>
        <TaskSummaryCard
          icon={<CircleAlert />}
          label={t("dueOverdue")}
          value={view.summary.dueOrOverdue}
          insight={view.summary.overdue ? t("overdueCount", { count: view.summary.overdue }) : t("nothingOverdue")}
          active={tab === "DUE"}
          onClick={() => setTab("DUE")}
        />
        <TaskSummaryCard
          icon={<CalendarClock />}
          label={t("upcoming")}
          value={view.summary.upcoming}
          insight={nextUpcoming ? t("nextDue", { date: formatDateOnlyLocale(nextUpcoming, locale) }) : t("noUpcomingDueDates")}
          active={tab === "UPCOMING"}
          onClick={() => setTab("UPCOMING")}
        />
        <TaskSummaryCard
          icon={<CheckCircle2 />}
          label={t("completedThisMonth")}
          value={view.summary.completedThisMonth}
          insight={t("completedOccurrences")}
          active={tab === "COMPLETED"}
          onClick={() => setTab("COMPLETED")}
        />
      </section>
      <section className="operations-panel operations-task-panel">
        <div className="operations-panel-header operations-task-panel-head">
          <div className="operations-segmented-tabs" role="tablist" aria-label={t("taskViews")}>
            <button type="button" role="tab" aria-selected={tab === "DUE"} className={tab === "DUE" ? "is-active" : ""} onClick={() => setTab("DUE")}>{t("dueOverdue")}</button>
            <button type="button" role="tab" aria-selected={tab === "UPCOMING"} className={tab === "UPCOMING" ? "is-active" : ""} onClick={() => setTab("UPCOMING")}>{t("upcoming")}</button>
            <button type="button" role="tab" aria-selected={tab === "COMPLETED"} className={tab === "COMPLETED" ? "is-active" : ""} onClick={() => setTab("COMPLETED")}>{t("completed")}</button>
          </div>
          <div className="operations-count-pill">{t("shownCount", { count: items.length })}</div>
        </div>
        <div className="operations-filters operations-task-filters">
          <label className="operations-search">
            <Search aria-hidden="true" />
            <span className="sr-only">{t("searchTasks")}</span>
            <Input
              type="search"
              placeholder={t("searchTaskPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label={t("taskPriorityFilter")}>
            <option value="ALL">{t("allPriorities")}</option>
            <option value="HIGH">{t("high")}</option>
            <option value="MEDIUM">{t("medium")}</option>
            <option value="LOW">{t("low")}</option>
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
                      {task.dueDate
                        ? task.overdue
                          ? t("overdueOn", { date: formatDateOnlyLocale(task.dueDate, locale) })
                          : t("dueOn", { date: formatDateOnlyLocale(task.dueDate, locale) })
                        : t("noDueDate")}
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
            title={view.items.length ? t("noTasksInView") : t("noTasksDue")}
            description={view.items.length ? t("tryAnotherTaskView") : t("caughtUpTasks")}
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
  const t = useTranslations("operations");
  if (!task.linkedLabel || !task.linkedEntityType || !task.linkedEntityId) return null;
  const href =
    task.linkedEntityType === "SPACE"
      ? `/building?space=${encodeURIComponent(task.linkedEntityId)}`
      : task.linkedEntityType === "MAINTENANCE"
        ? `/operations/maintenance?search=${encodeURIComponent(task.linkedLabel.split(" · ")[0])}`
        : task.linkedEntityType === "INVOICE"
          ? `/billing/invoices/${task.linkedEntityId}`
          : "/building";
  return <Link className="operations-context-link" href={href}>{localizedTaskLinkLabel(task, t)}</Link>;
}

function localizedTaskLinkLabel(
  task: import("../domain/types").TaskListItemView,
  t: ReturnType<typeof useTranslations<"operations">>,
) {
  if (!task.linkedLabel) return null;
  if (task.linkedEntityType === "PROPERTY" && task.linkedLabel === "Property") return t("property");
  if (task.linkedEntityType === "SPACE" && task.linkedLabel === "Space") return t("space");
  if (task.linkedEntityType === "MAINTENANCE" && task.linkedLabel === "Maintenance issue") return t("maintenanceIssue");
  if (task.linkedEntityType === "INVOICE" && task.linkedLabel === "Invoice") return t("invoice");
  return task.linkedLabel;
}
