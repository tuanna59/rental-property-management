import * as React from "react";

import { cn } from "@/lib/utils";

export type StatusBadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export function StatusBadge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusBadgeTone }) {
  return (
    <span
      data-tone={tone}
      className={cn("app-status-badge", className)}
      {...props}
    />
  );
}
