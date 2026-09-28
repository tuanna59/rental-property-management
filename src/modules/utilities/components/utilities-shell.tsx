"use client";

import type { ReactNode } from "react";

import "./utilities.css";

export function UtilitiesShell({ children }: { children: ReactNode }) {
  return (
    <main className="utilities-app">
      <div className="utilities-workspace">{children}</div>
    </main>
  );
}
