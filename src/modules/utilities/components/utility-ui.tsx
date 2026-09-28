"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, CircleAlert, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get("month");
  const selectedMonth = validMonth(urlMonth) ? urlMonth : month;
  return (
    <label className="month-selector">
      <span className="sr-only">Billing month</span>
      <Input
        type="month"
        value={selectedMonth}
        onChange={(event) => {
          const url = new URL(window.location.href);
          url.searchParams.set("month", event.target.value);
          router.push(`${url.pathname}?${url.searchParams.toString()}`);
        }}
      />
    </label>
  );
}

function validMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

export function UtilityStatusBadge({
  status,
}: {
  status:
    | "complete"
    | "missing"
    | "estimated"
    | "incomplete"
    | "closing-set"
    | "locked"
    | "optional"
    | "needs-closing"
    | "n-a";
}) {
  const copy = {
    complete: "Complete",
    missing: "Missing",
    estimated: "Estimated",
    incomplete: "Incomplete",
    "closing-set": "Closing set",
    locked: "Locked",
    optional: "Optional",
    "needs-closing": "Needs closing",
    "n-a": "N/A",
  }[status];
  const normalized =
    status === "closing-set" || status === "locked"
      ? "complete"
      : status === "optional" || status === "n-a"
        ? "estimated"
        : status === "needs-closing"
          ? "incomplete"
          : status;
  const Icon =
    normalized === "complete"
      ? Check
      : normalized === "estimated"
        ? LoaderCircle
        : normalized === "missing"
          ? CircleAlert
          : AlertTriangle;
  return (
    <span className={cn("utility-status", `is-${normalized}`)}>
      <Icon />
      {copy}
    </span>
  );
}

export function EmptyUtilitiesState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="utilities-empty">
      <div className="utilities-empty-icon">
        <CircleAlert />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action && <div className="utilities-empty-action">{action}</div>}
    </div>
  );
}

export { Button };
