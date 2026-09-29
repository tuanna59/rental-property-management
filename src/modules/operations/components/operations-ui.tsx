"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  Flame,
  Info,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  MaintenancePriority,
  MaintenanceStatus,
  TaskPriority,
  TaskStatus,
} from "../domain/types";

export function OperationsStatusBadge({
  status,
}: {
  status: MaintenanceStatus | TaskStatus;
}) {
  const t = useTranslations("operations");
  const config =
    status === "OPEN"
      ? { label: t("open"), tone: "warning", icon: CircleDot }
      : status === "IN_PROGRESS"
        ? { label: t("inProgress"), tone: "info", icon: Clock3 }
        : status === "COMPLETED" || status === "DONE"
          ? {
              label: status === "DONE" ? t("done") : t("completed"),
              tone: "success",
              icon: CheckCircle2,
            }
          : { label: t("toDo"), tone: "neutral", icon: CircleDot };
  const Icon = config.icon;
  return (
    <span className={cn("operations-badge", `is-${config.tone}`)}>
      <Icon aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function OperationsPriorityBadge({
  priority,
}: {
  priority: MaintenancePriority | TaskPriority;
}) {
  const t = useTranslations("operations");
  const config =
    priority === "URGENT"
      ? { label: t("urgent"), tone: "danger", icon: Flame }
      : priority === "HIGH"
        ? { label: t("high"), tone: "warning", icon: AlertTriangle }
        : priority === "MEDIUM"
          ? { label: t("medium"), tone: "info", icon: Info }
          : { label: t("low"), tone: "neutral", icon: Wrench };
  const Icon = config.icon;
  return (
    <span className={cn("operations-badge", `is-${config.tone}`)}>
      <Icon aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function OperationsEmptyState({
  icon: Icon = Wrench,
  title,
  description,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="operations-empty">
      <div className="operations-empty-icon">
        <Icon aria-hidden="true" />
      </div>
      <div className="operations-empty-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action && <div className="operations-empty-action">{action}</div>}
    </div>
  );
}

export function useOperationsLabels() {
  const t = useTranslations("operations");

  const localizedCategoryLabel = React.useCallback(
    (value: string) => {
      switch (value) {
        case "REPAIR":
          return t("repair");
        case "UTILITIES":
          return t("utilitiesCategory");
        case "CLEANING":
          return t("cleaning");
        case "SUPPLIES":
          return t("supplies");
        case "OTHER":
          return t("other");
        default:
          return value;
      }
    },
    [t],
  );

  return { categoryLabel: localizedCategoryLabel };
}
