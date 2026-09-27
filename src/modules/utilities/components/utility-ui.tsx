"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CircleAlert, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  return (
    <label className="month-selector">
      <span className="sr-only">Billing month</span>
      <Input
        type="month"
        value={month}
        onChange={(event) => {
          const url = new URL(window.location.href);
          url.searchParams.set("month", event.target.value);
          router.push(`${url.pathname}?${url.searchParams.toString()}`);
        }}
      />
    </label>
  );
}

export function UtilityStatusBadge({
  status,
}: {
  status: "complete" | "missing" | "estimated" | "incomplete";
}) {
  const copy = {
    complete: "Complete",
    missing: "Missing",
    estimated: "Estimated",
    incomplete: "Incomplete",
  }[status];
  const Icon =
    status === "complete"
      ? Check
      : status === "estimated"
        ? LoaderCircle
        : status === "missing"
          ? CircleAlert
          : AlertTriangle;
  return (
    <span className={cn("utility-status", `is-${status}`)}>
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
