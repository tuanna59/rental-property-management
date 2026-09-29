import { Building2, DatabaseZap } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAppEnvironment } from "@/lib/app-environment";
import { getServerTranslator } from "@/i18n/server";
import "@/modules/assets/components/assets.css";
import { getAssetInventoryPage, getDevicePage } from "@/modules/assets/server/assets.queries";
import "@/modules/operations/components/operations.css";
import { getMaintenancePage, getTaskPage } from "@/modules/operations/server/operations.queries";
import { PropertyDashboard } from "@/modules/property/components/property-dashboard";
import {
  getActivePersonOptions,
  getBuildingVisualProjection,
} from "@/modules/property/server/property.queries";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const t = await getServerTranslator("building");
  let property;
  let people;

  try {
    [property, people] = await Promise.all([
      getBuildingVisualProjection(),
      getActivePersonOptions(),
    ]);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      console.error("Database is unavailable for the property dashboard.", error);
      return <DatabaseUnavailable />;
    }
    throw error;
  }

  if (!property) {
    const isProduction = getAppEnvironment() === "production";
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-page-bg)] px-4 text-[var(--app-text-primary)]">
        <section className="flex max-w-md flex-col items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center shadow-sm">
          <Building2 className="size-12 text-[var(--app-brand)]" />
          <h1 className="mt-4 text-2xl font-semibold">
            {isProduction ? t("server.setupTitle") : t("server.noProperty")}
          </h1>
          <p className="mt-2 text-sm text-[var(--app-text-secondary)]">
            {isProduction ? t("server.setupDescription") : t("server.seedHint")}
          </p>
          <Button className="mt-5" asChild>
            {isProduction ? (
              <Link href="/setup">{t("server.setupAction")}</Link>
            ) : (
              <a href="https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding">
                {t("server.seedWorkflow")}
              </a>
            )}
          </Button>
        </section>
      </main>
    );
  }

  const [maintenance, tasks, assets, devices] = await Promise.all([
    getMaintenancePage(property.id),
    getTaskPage(property.id),
    getAssetInventoryPage(property.id),
    getDevicePage(property.id),
  ]);

  return (
    <PropertyDashboard
      property={property}
      people={people}
      inspectorData={{ maintenance, tasks, assets, devices }}
      initialSpaceId={(await searchParams).space ?? null}
    />
  );
}

function isDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === "ECONNREFUSED" ||
    (typeof record.message === "string" && record.message.toLowerCase().includes("connect"))
  );
}

async function DatabaseUnavailable() {
  const t = await getServerTranslator("building");
  const isProduction = getAppEnvironment() === "production";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-page-bg)] px-4 text-[var(--app-text-primary)]">
      <section className="w-full max-w-2xl rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[var(--app-warning-soft)] text-[var(--app-warning)]">
            <DatabaseZap className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-danger)]">{t("server.setupNeeded")}</p>
            <h1 className="mt-1 text-2xl font-semibold">{t("server.databaseNotRunning")}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--app-text-secondary)]">
              {t("server.databaseUnavailable")}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 rounded-md bg-[var(--app-surface-subtle)] p-4 text-sm">
          <p className="font-medium text-[var(--app-text-primary)]">
            {isProduction ? t("server.startProduction") : t("server.startDatabase")}
          </p>
          <code className="overflow-x-auto rounded-md border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-2 text-[var(--app-text-primary)]">
            {isProduction ? ".\\scripts\\prod-up.ps1" : "docker compose up -d postgres"}
          </code>
          <p className="font-medium text-[var(--app-text-primary)]">
            {isProduction ? t("server.applyProductionMigrations") : t("server.applySchemaSeed")}
          </p>
          <code className="overflow-x-auto rounded-md border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-2 text-[var(--app-text-primary)]">
            {isProduction ? ".\\scripts\\prod-migrate.ps1" : "pnpm db:migrate && pnpm db:seed"}
          </code>
        </div>
      </section>
    </main>
  );
}
