"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get("month");
  const selectedMonth = validMonth(urlMonth) ? urlMonth : month;
  const currentMonth = currentLocalMonth();

  const hrefForMonth = (nextMonth: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonth);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="meter-month-nav" aria-label="Billing month navigation">
      <Link
        href={hrefForMonth(shiftMonth(selectedMonth, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft aria-hidden="true" />
      </Link>
      <label>
        <span className="sr-only">Billing month</span>
        <Input
          aria-label="Billing month"
          type="month"
          value={selectedMonth}
          onChange={(event) => {
            if (!validMonth(event.target.value)) return;
            router.push(hrefForMonth(event.target.value));
          }}
        />
      </label>
      <Link
        href={hrefForMonth(shiftMonth(selectedMonth, 1))}
        aria-label="Next month"
      >
        <ChevronRight aria-hidden="true" />
      </Link>
      <Link
        className="current-month-link"
        href={hrefForMonth(currentMonth)}
        aria-current={selectedMonth === currentMonth ? "date" : undefined}
      >
        Current
      </Link>
    </div>
  );
}

function validMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + amount, 1))
    .toISOString()
    .slice(0, 7);
}

function currentLocalMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
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
