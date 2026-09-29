"use client";

import { useTranslations } from "next-intl";

export function BillingStatusBadge({ status }: { status: string }) {
  const t = useTranslations("billing");
  const tone =
    status === "READY" ||
    status === "FINALIZED" ||
    status === "PAID" ||
    status === "HELD" ||
    status === "COMPLETE"
      ? "is-complete"
      : status === "MISSING_DATA" ||
          status === "UNPAID" ||
          status === "NEEDS_SETTLEMENT" ||
          status === "INCOMPLETE"
        ? "is-incomplete"
        : "is-estimated";

  const key = STATUS_KEYS[status] ?? null;
  const label = key ? t(key) : status.toLowerCase().replaceAll("_", " ");

  return <span className={`utility-status billing-status ${tone}`}>{label}</span>;
}

const STATUS_KEYS: Record<string, "ready" | "finalized" | "paid" | "held" | "missingData" | "unpaid" | "needsSettlement" | "partial" | "draft" | "complete" | "incomplete" | "estimated" | "measured" | "overridden"> = {
  READY: "ready",
  FINALIZED: "finalized",
  PAID: "paid",
  HELD: "held",
  MISSING_DATA: "missingData",
  UNPAID: "unpaid",
  NEEDS_SETTLEMENT: "needsSettlement",
  PARTIAL: "partial",
  DRAFT: "draft",
  COMPLETE: "complete",
  INCOMPLETE: "incomplete",
  ESTIMATED: "estimated",
  MEASURED: "measured",
  OVERRIDDEN: "overridden",
};
