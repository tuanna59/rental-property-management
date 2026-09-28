"use client";

import * as React from "react";
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
import { formatDate } from "@/lib/presentation";

import type { getMonthlyMeterEntries } from "../server/utility.queries";
import { MeterHistory } from "./meter-history";
import { MeterReadingDialog } from "./meter-reading-dialog";
import { ReplaceMeterDialog } from "./replace-meter-dialog";
import { BoundaryReadingDialog } from "./boundary-reading-dialog";

type Entry = Awaited<ReturnType<typeof getMonthlyMeterEntries>>[number];
type Tab = "breakdown" | "history";

export function MeterDetails({
  entry,
  triggerLabel = "Manage",
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
  const [tab, setTab] = React.useState<Tab>(initialTab);
  if (!entry.activeMeter) return null;
  const currentMeter = entry.history.find((meter) => !meter.removedAt) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <Gauge /> {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="meter-details-dialog">
        <DialogHeader>
          <DialogTitle>{entry.room} · Electricity meter</DialogTitle>
          <DialogDescription>
            Current meter context, selected-cycle calculation, attribution, and
            complete reading history.
          </DialogDescription>
        </DialogHeader>

        <section className="meter-current-summary">
          <div>
            <span>Current meter</span>
            <strong>{currentMeter?.meterNumber || "No active meter"}</strong>
            <small>
              {currentMeter
                ? `Installed ${formatDate(currentMeter.installedAt)}`
                : "No physical meter is currently active"}
            </small>
          </div>
          {currentMeter && <span className="utility-status is-complete">Active</span>}
          <div>
            <span>Latest reading</span>
            <strong>
              {currentMeter?.latestReading
                ? `${Number(currentMeter.latestReading.readingValue).toLocaleString()} kWh`
                : "—"}
            </strong>
            <small>
              {currentMeter?.latestReading
                ? formatDate(currentMeter.latestReading.readingDate)
                : "No readings"}
            </small>
          </div>
        </section>

        {!readOnly && currentMeter && (
          <div className="meter-detail-actions">
            <MeterReadingDialog meterId={currentMeter.id} />
            <ReplaceMeterDialog spaceId={entry.spaceId} />
          </div>
        )}

        <nav className="meter-detail-tabs" aria-label="Meter details sections">
          <button
            type="button"
            className={tab === "breakdown" ? "is-active" : ""}
            onClick={() => setTab("breakdown")}
          >
            <Layers3 /> Monthly breakdown
          </button>
          <button
            type="button"
            className={tab === "history" ? "is-active" : ""}
            onClick={() => setTab("history")}
          >
            <History /> Reading history
          </button>
        </nav>

        {tab === "breakdown" && (
          <MonthlyBreakdown entry={entry} readOnly={readOnly} />
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
}: {
  entry: Entry;
  readOnly?: boolean;
}) {
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
      ? "Locked"
      : entry.closingStatus === "CLOSING_SET"
        ? "Closed"
        : entry.closingStatus === "NEEDS_CLOSING"
          ? "Open"
          : entry.closingStatus === "OPTIONAL"
            ? "Optional"
            : "No meter";
  const closingQuality =
    entry.closingDateQuality === "EARLY"
      ? "Early"
      : entry.closingDateQuality === "LATE" ||
          entry.closingDateQuality === "VERY_LATE"
        ? `Late ${entry.closingDateOffsetDays}d`
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
        <strong className="meter-cycle-month">{monthName(entry.billingMonth)}</strong>
        <div className="meter-cycle-summary-grid">
          <div>
            <span>Opening reading</span>
            <strong>
              {openingReading
                ? `${Number(openingReading.readingValue).toLocaleString()} kWh`
                : "—"}
            </strong>
            {openingReading && <small>{shortDate(openingReading.readingDate)}</small>}
          </div>
          <div>
            <span>Monthly closing</span>
            <strong>
              {entry.monthlyReading
                ? `${Number(entry.monthlyReading.readingValue).toLocaleString()} kWh`
                : entry.closingRequired
                  ? "Not assigned"
                  : "Optional"}
            </strong>
            {entry.monthlyReading && (
              <small>
                {shortDate(entry.monthlyReading.readingDate)}
                {closingQuality ? ` · ${closingQuality}` : ""}
              </small>
            )}
          </div>
          <div>
            <span>Cycle usage</span>
            <strong>
              {cycleUsage === null
                ? "Incomplete"
                : `${cycleUsage.toLocaleString()} kWh`}
            </strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{cycleStatus}</strong>
            {entry.closingStatus === "LOCKED" && entry.lockInvoice && (
              <small>Used by finalized invoice</small>
            )}
          </div>
        </div>
        {showKnownUsage && knownUsage !== null && (
          <div className="meter-known-usage-note">
            <span>
              Known usage
              {entry.latestReading
                ? ` through ${shortDate(entry.latestReading.readingDate)}`
                : ""}
            </span>
            <strong>{knownUsage.toLocaleString()} kWh</strong>
          </div>
        )}
      </section>

      {entry.monthlyReading && closingQuality && (
        <p className="meter-inline-warning">
          ⚠ {closingQuality.startsWith("Late") ? "Late closing" : "Early closing"}
          {closingQuality.startsWith("Late")
            ? ` · Reading was taken ${entry.closingDateOffsetDays} day${entry.closingDateOffsetDays === 1 ? "" : "s"} after month end.`
            : " · Reading was taken before month end."}
        </p>
      )}

      {!entry.closingRequired && entry.isVacantEntireMonth && (
        <p className="utility-subtle">
          Vacant for the selected month · monthly closing optional.
        </p>
      )}

      {entry.meterSegments.length > 1 && (
        <details className="meter-segment-disclosure">
          <summary>
            <span>Cycle spans {entry.meterSegments.length} physical meters</span>
            <strong>View meter segments</strong>
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
                  <span>{segment.meterNumber || "Unnumbered meter"}</span>
                  <small>
                    {formatDate(start)} → {finish ? formatDate(finish) : "ongoing"}
                  </small>
                  <strong>
                    {segmentUsage === null
                      ? "Usage unavailable"
                      : `${Number(segmentUsage).toLocaleString()} kWh`}
                  </strong>
                </div>
              );
            })}
            <div className="meter-segment-total">
              <span>Total</span>
              <strong>
                {cycleUsage !== null
                  ? `${cycleUsage.toLocaleString()} kWh`
                  : knownUsage !== null
                    ? `${knownUsage.toLocaleString()} kWh known`
                    : "Unavailable"}
              </strong>
            </div>
          </section>
        </details>
      )}

      {total > 0 && (
        <div
          className="usage-timeline"
          aria-label="Known tenant and vacant electricity usage"
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
                  title={`${segment.label}: ${amount.toLocaleString()} kWh`}
                >
                  <span>{segment.label}</span>
                  <strong>{amount.toLocaleString()}</strong>
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
                  ? `${Number(segment.usage).toLocaleString()} kWh`
                  : `${Number(segment.usage).toLocaleString()} kWh known so far`}
                {" · "}
                {formatDate(segment.startDate)} →{" "}
                {segment.isOpen ? "ongoing" : formatDate(segment.endDate)}
              </small>
            </div>
          </div>
        ))}
      </div>

      {blockingWarnings.length > 0 && (
        <div className="meter-breakdown-empty">
          <strong>Utility data needs attention</strong>
          <p>{blockingWarnings[0]}</p>
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
        <p className="meter-inline-note">{nonBlockingWarnings[0]}</p>
      )}
    </section>
  );
}

function monthName(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
}
