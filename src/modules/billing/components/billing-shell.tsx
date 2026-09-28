"use client";

import type { ReactNode } from "react";

import "@/modules/utilities/components/utilities.css";
import "./billing.css";

export function BillingShell({ children }: { children: ReactNode }) {
  return (
    <main className="utilities-app">
      <div className="utilities-workspace">{children}</div>
    </main>
  );
}
