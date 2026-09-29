"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Gauge, History, Layers3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AppLocale } from "@/i18n/config";
import { formatCompactDateLocale, formatDateOnlyLocale, formatMonthLocale, formatNumberLocale } from "@/i18n/format";

import type { getMonthlyMeterEntries } from "../server/utility.queries";
import { MeterHistory } from "./meter-history";
import { MeterReadingDialog } from "./meter-reading-dialog";
import { ReplaceMeterDialog } from "./replace-meter-dialog";
import { BoundaryReadingDialog } from "./boundary-reading-dialog";
import { translateUtilityWarning } from "./utility-presentation";

type Entry = Awaited<ReturnType<typeof getMonthlyMeterEntries>>[number];
type Tab = "breakdown" | "history";

export function MeterDetails({
  entry,
  triggerLabel,
  initialTab = "breakdown",
  open,
  onOpenChange,
  hideTrigger = false,
  readOnly = false,
}: {
  entry: Entry;
  triggerLabel?: string;
  initialTab?: Tab;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  readOnly?: boolean;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  const [tab, setTab] = React.useState<Tab>(initialTab);
  if (!entry.activeMeter) return null;
  const currentMeter = entry.history.find((meter) => !meter.removedAt) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <Gauge /> {triggerLabel ?? t("manage")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="meter-details-dialog">
        <DialogHeader>
          <DialogTitle>{entry.room} · {t("electricityMeter")}</DialogTitle>
<DialogDescription>{t("meterDetailsDescription")}</DialogDescription>
        </DialogHeader>

        <section className="meter-current-summary">
          <div>
            <span>{t("currentMeter")}</span>
            <strong>{currentMeter?.meterNumber || t("noActiveMeter")}</strong>
            <small>
              {currentMeter
                ? t("installed", { date: formatDateOnlyLocale(currentMeter.installedAt, locale) })
                : t("noPhysicalMeterActive")}
            </small>
          </div>
          {currentMeter && <span className="utility-status is-complete">{t("active")}</span>}
          <div>
            <span>{t("latestReading")}</span>
            <strong>
              {currentMeter?.latestReading
                ? `${formatNumberLocale(currentMeter.latestReading.readingValue, locale)} kWh`
                : "—"}
            </strong>
            <small>
              {currentMeter?.latestReading
                ? formatDateOnlyLocale(currentMeter.latestReading.readingDate, locale)
                : t("noReadings")}
            </small>
          </div>
        </section>

        {!readOnly && currentMeter && (
          <div className="meter-detail-actions">
            <MeterReadingDialog meterId={currentMeter.id} />
            <ReplaceMeterDialog spaceId={entry.spaceId} />
          </div>
        )}

        <nav className="meter-detail-tabs" aria-label={t("meterDetailsSections")}>
          <button
            type="button"
            className={tab === "breakdown" ? "is-active" : ""}
            onClick={() => setTab("breakdown")}
          >
            <Layers3 /> {t("monthlyBreakdown")}
          </button>
          <button
            type="button"
            className={tab === "history" ? "is-active" : ""}
            onClick={() => setTab("history")}
          >
            <History /> {t("readingHistory")}
          </button>
        </nav>

        {tab === "breakdown" && (
          <MonthlyBreakdown entry={entry} readOnly={readOnly} locale={locale} />
        )}
        {tab === "history" && (
          <MeterHistory history={entry.history} readOnly={readOnly} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MonthlyBreakdown({
  entry,
  readOnly = false,
  locale,
}: {
  entry: Entry;
  readOnly?: boolean;
  locale: AppLocale;
}) {
  const t = useTranslations("utilities");
  const allSegments = entry.tenancySegments;
  const total = allSegments.reduce(
    (sum, segment) => sum + Number(segment.usage),
    0,
  );
  const cycleUsage =
    entry.monthlyPhysicalUsage === null
      ? null
      : Number(entry.monthlyPhysicalUsage);
  const knownUsage =
    entry.knownPhysicalUsage === null ? null : Number(entry.knownPhysicalUsage);
  const showKnownUsage =
    knownUsage !== null &&
    (cycleUsage === null || Math.abs(knownUsage - cycleUsage) > 0.000001);
  const openingReading =
    entry.meterSegments.find((segment) => segment.openingReading)?.openingReading ??
    entry.previousClosingReading;
  const cycleStatus =
    entry.closingStatus === "LOCKED"
      ? t("locked")
      : entry.closingStatus === "CLOSING_SET"
        ? t("closed")
        : entry.closingStatus === "NEEDS_CLOSING"
          ? t("open")
          : entry.closingStatus === "OPTIONAL"
            ? t("optional")
            : t("noMeter");
  const closingQuality =
    entry.closingDateQuality === "EARLY"
      ? t("early")
      : entry.closingDateQuality === "LATE" || entry.closingDateQuality === "VERY_LATE"
        ? entry.closingDateOffsetDays == null
          ? t("lateClosing")
          : t("lateDays", { days: entry.closingDateOffsetDays })
        : null;
  const blockingWarnings = entry.warnings.filter(
    (warning) =>
      warning.startsWith("Missing") ||
      warning.includes("required for this room") ||
      warning.includes("decrease inside this physical meter segment"),
  );
  const nonBlockingWarnings = entry.warnings.filter(
    (warning) => !blockingWarnings.includes(warning),
  );

  return (
    <section className="meter-breakdown">
      <section className="meter-cycle-summary-card">
        <strong className="meter-cycle-month">{formatMonthLocale(entry.billingMonth, locale)}</strong>
        <div className="meter-cycle-summary-grid">
          <div>
            <span>{t("openingReading")}</span>
            <strong>
              {openingReading
                ? `${formatNumberLocale(openingReading.readingValue, locale)} kWh`
                : "—"}
            </strong>
            {openingReading && <small>{formatCompactDateLocale(openingReading.readingDate, locale)}</small>}
          </div>
          <div>
            <span>{t("monthlyClosing")}</span>
            <strong>
              {entry.monthlyReading
                ? `${formatNumberLocale(entry.monthlyReading.readingValue, locale)} kWh`
                : entry.closingRequired
                  ? t("notAssigned")
                  : t("optional")}
            </strong>
            {entry.monthlyReading && (
              <small>
                {formatCompactDateLocale(entry.monthlyReading.readingDate, locale)}
                {closingQuality ? ` · ${closingQuality}` : ""}
              </small>
            )}
          </div>
          <div>
            <span>{t("cycleUsageLabel")}</span>
            <strong>
              {cycleUsage === null
                ? t("incomplete")
                : `${formatNumberLocale(cycleUsage, locale)} kWh`}
            </strong>
          </div>
          <div>
            <span>{t("status")}</span>
            <strong>{cycleStatus}</strong>
            {entry.closingStatus === "LOCKED" && entry.lockInvoice && (
              <small>{t("usedByFinalizedInvoice")}</small>
            )}
          </div>
        </div>
        {showKnownUsage && knownUsage !== null && (
          <div className="meter-known-usage-note">
            <span>
              {entry.latestReading
                ? t("knownThrough", { date: formatCompactDateLocale(entry.latestReading.readingDate, locale) })
                : t("knownUsage")}
            </span>
            <strong>{formatNumberLocale(knownUsage, locale)} kWh</strong>
          </div>
        )}
      </section>

      {entry.monthlyReading && closingQuality && (
        <p className="meter-inline-warning">
          ⚠ {entry.closingDateQuality === "EARLY" ? t("earlyClosing") : t("lateClosing")}
          {" · "}
          {entry.closingDateQuality === "EARLY"
            ? t("earlyClosingDetail")
            : entry.closingDateOffsetDays == null
              ? t("lateClosing")
              : t("lateClosingDetail", { days: entry.closingDateOffsetDays })}
        </p>
      )}

      {!entry.closingRequired && entry.isVacantEntireMonth && (
<p className="utility-subtle">{t("vacantMonthOptional")}</p>
      )}

      {entry.meterSegments.length > 1 && (
        <details className="meter-segment-disclosure">
          <summary>
            <span>{t("cycleSpansMeters", { count: entry.meterSegments.length })}</span>
            <strong>{t("viewMeterSegments")}</strong>
          </summary>
          <section className="meter-physical-segments">
            {entry.meterSegments.map((segment) => {
              const start =
                segment.openingReading?.readingDate ?? segment.installedAt;
              const finish =
                segment.closingReading?.readingDate ??
                segment.knownEndReading?.readingDate ??
                segment.removedAt;
              const segmentUsage =
                segment.physicalUsage ?? segment.knownPhysicalUsage;
              return (
                <div key={segment.meterId}>
                  <span>{segment.meterNumber || t("unnumberedMeter")}</span>
                  <small>
                    {formatDateOnlyLocale(start, locale)} → {finish ? formatDateOnlyLocale(finish, locale) : t("ongoing")}
                  </small>
                  <strong>
                    {segmentUsage === null
                      ? t("usageUnavailable")
                      : `${formatNumberLocale(segmentUsage, locale)} kWh`}
                  </strong>
                </div>
              );
            })}
            <div className="meter-segment-total">
              <span>{t("total")}</span>
              <strong>
                {cycleUsage !== null
                  ? `${formatNumberLocale(cycleUsage, locale)} kWh`
                  : knownUsage !== null
                    ? `${formatNumberLocale(knownUsage, locale)} kWh ${t("knownSuffix")}`
                    : t("unavailable")}
              </strong>
            </div>
          </section>
        </details>
      )}

      {total > 0 && (
        <div
          className="usage-timeline"
          aria-label={t("knownTenantVacantUsage")}
        >
          {allSegments
            .filter((segment) => Number(segment.usage) > 0)
            .map((segment, index) => {
              const amount = Number(segment.usage);
              return (
                <div
                  key={`${segment.label}-${index}`}
                  className={
                    segment.kind === "VACANT" ? "is-vacant" : "is-tenant"
                  }
                  style={{ width: `${Math.max((amount / total) * 100, 5)}%` }}
                  title={`${segment.label}: ${formatNumberLocale(amount, locale)} kWh`}
                >
                  <span>{segment.label}</span>
                  <strong>{formatNumberLocale(amount, locale)}</strong>
                </div>
              );
            })}
        </div>
      )}

      <div className="usage-legend">
        {allSegments.map((segment, index) => (
          <div key={`${segment.label}-legend-${index}`}>
            <span
              className={segment.kind === "VACANT" ? "is-vacant" : "is-tenant"}
            />
            <div>
              <strong>{segment.label}</strong>
              <small>
                {segment.usageKnown
                  ? `${formatNumberLocale(segment.usage, locale)} kWh`
                  : `${formatNumberLocale(segment.usage, locale)} kWh ${t("knownSoFarSuffix")}`}
                {" · "}
                {formatDateOnlyLocale(segment.startDate, locale)} →{" "}
                {segment.isOpen ? t("ongoing") : formatDateOnlyLocale(segment.endDate, locale)}
              </small>
            </div>
          </div>
        ))}
      </div>

      {blockingWarnings.length > 0 && (
        <div className="meter-breakdown-empty">
          <strong>{t("utilityDataAttention")}</strong>
          <p>{translateUtilityWarning(blockingWarnings[0], t, locale)}</p>
          {!readOnly &&
            entry.missingBoundary.map((boundary) => (
              <BoundaryReadingDialog
                key={`${boundary.tenancyId}-${boundary.boundaryType}`}
                boundary={boundary}
                room={entry.room}
              />
            ))}
        </div>
      )}

      {blockingWarnings.length === 0 && nonBlockingWarnings.length > 0 && (
        <p className="meter-inline-note">{translateUtilityWarning(nonBlockingWarnings[0], t, locale)}</p>
      )}
    </section>
  );
}

