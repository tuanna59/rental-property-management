"use client";

import { AppSidebar } from "@/modules/property/components/property-dashboard";
import type { DashboardProperty } from "@/modules/property/domain/types";

import "./utilities.css";

export function UtilitiesShell({
  property,
  children,
}: {
  property: DashboardProperty;
  children: React.ReactNode;
}) {
  return (
    <main className="property-app utilities-app">
      <AppSidebar property={property} collapsed={false} />
      <div className="utilities-workspace">{children}</div>
    </main>
  );
}
