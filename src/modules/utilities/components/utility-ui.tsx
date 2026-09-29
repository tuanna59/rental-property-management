"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/config";
import { formatMonthLocale } from "@/i18n/format";
import { cn } from "@/lib/utils";

export function MonthSelector({ month }: { month: string }) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
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
    <div className="meter-month-nav" aria-label={t("billingMonth")}>
      <Link
        href={hrefForMonth(shiftMonth(selectedMonth, -1))}
        aria-label={t("previousMonth")}
      >
        <ChevronLeft aria-hidden="true" />
      </Link>
      <label className="meter-month-picker">
        <span className="sr-only">{t("billingMonth")}</span>
        <span className="meter-month-picker-label" aria-hidden="true">
          {formatMonthLocale(selectedMonth, locale)}
        </span>
        <CalendarDays aria-hidden="true" />
        <input
          className="meter-month-native-input"
          aria-label={t("billingMonth")}
          lang={locale === "vi" ? "vi-VN" : "en-US"}
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
        aria-label={t("nextMonth")}
      >
        <ChevronRight aria-hidden="true" />
      </Link>
      <Link
        className="current-month-link"
        href={hrefForMonth(currentMonth)}
        aria-current={selectedMonth === currentMonth ? "date" : undefined}
      >
        {t("currentMonth")}
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
  const t = useTranslations("utilities");
  const copy = {
    complete: t("complete"),
    missing: t("missing"),
    estimated: t("estimated"),
    incomplete: t("incomplete"),
    "closing-set": t("closingSet"),
    locked: t("locked"),
    optional: t("optional"),
    "needs-closing": t("needsClosing"),
    "n-a": t("notApplicable"),
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
