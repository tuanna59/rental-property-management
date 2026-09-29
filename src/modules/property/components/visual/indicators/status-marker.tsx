import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusMarker({
  icon: Icon,
  label,
  count,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  tone?: "neutral" | "success" | "info" | "warning" | "danger";
}) {
  return (
    <span
      className={cn("building-v2-marker", `is-${tone}`)}
      title={label}
      aria-label={count ? `${label}: ${count}` : label}
    >
      <Icon aria-hidden="true" />
      {typeof count === "number" && count > 0 && <b>{count}</b>}
    </span>
  );
}
