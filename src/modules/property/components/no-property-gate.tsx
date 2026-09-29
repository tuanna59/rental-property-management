"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppEnvironment } from "@/lib/app-environment";

export function NoPropertyGate({
  environment,
  children,
}: {
  environment: AppEnvironment;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("setup");

  if (environment !== "production" || pathname === "/setup") {
    return children;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-page-bg)] px-4 py-10 text-[var(--app-text-primary)]">
      <section className="w-full max-w-lg rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-7 text-center shadow-sm sm:p-9">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
          <Building2 className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-brand)]">
          Rental House
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{t("empty.title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--app-text-secondary)]">
          {t("empty.description")}
        </p>
        <Button className="mt-6" asChild>
          <Link href="/setup">
            {t("empty.action")}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </main>
  );
}
