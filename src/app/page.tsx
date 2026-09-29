import { Building2, DatabaseZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PropertyDashboard } from "@/modules/property/components/property-dashboard";
import { getSpaceMaintenanceSignals } from "@/modules/operations/server/operations.queries";
import { getSpaceAssetSummaries } from "@/modules/assets/server/assets.queries";
import {
  getActivePersonOptions,
  getPrimaryPropertyDashboard,
} from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  let property;
  let people;
  let maintenanceSignals;
  let assetSignals;

  try {
    [property, people] = await Promise.all([
      getPrimaryPropertyDashboard(),
      getActivePersonOptions(),
    ]);
    [maintenanceSignals, assetSignals] = property
      ? await Promise.all([
          getSpaceMaintenanceSignals(property.id),
          getSpaceAssetSummaries(property.id),
        ])
      : [[], []];
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      console.error(
        "Database is unavailable for the property dashboard.",
        error,
      );
      return <DatabaseUnavailable />;
    }

    throw error;
  }

  if (!property) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-page-bg)] px-4 text-[var(--app-text-primary)]">
        <section className="flex max-w-md flex-col items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center shadow-sm">
          <Building2 className="size-12 text-[var(--app-brand)]" />
          <h1 className="mt-4 text-2xl font-semibold">No property found</h1>
          <p className="mt-2 text-sm text-[var(--app-text-secondary)]">
            Run the development seed to create the initial configurable rental
            property.
          </p>
          <Button className="mt-5" asChild>
            <a href="https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding">
              Seed workflow
            </a>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <PropertyDashboard
      property={property}
      people={people}
      maintenanceSignals={maintenanceSignals ?? []}
      assetSignals={assetSignals ?? []}
      initialSpaceId={(await searchParams).space ?? null}
    />
  );
}

function isDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === "ECONNREFUSED" ||
    (typeof record.message === "string" &&
      record.message.toLowerCase().includes("connect"))
  );
}

function DatabaseUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-page-bg)] px-4 text-[var(--app-text-primary)]">
      <section className="w-full max-w-2xl rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[var(--app-warning-soft)] text-[var(--app-warning)]">
            <DatabaseZap className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-danger)]">
              Setup needed
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Database is not running
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--app-text-secondary)]">
              The web server is reachable, but the dashboard needs PostgreSQL on
              port 5432 before it can load property data.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-md bg-[var(--app-surface-subtle)] p-4 text-sm">
          <p className="font-medium text-[var(--app-text-primary)]">
            Start the local database:
          </p>
          <code className="overflow-x-auto rounded-md bg-[var(--app-text-primary)] px-3 py-2 text-white">
            docker compose up -d postgres
          </code>
          <p className="font-medium text-[var(--app-text-primary)]">
            Then apply schema and seed data:
          </p>
          <code className="overflow-x-auto rounded-md bg-[var(--app-text-primary)] px-3 py-2 text-white">
            pnpm db:migrate && pnpm db:seed
          </code>
        </div>
      </section>
    </main>
  );
}
