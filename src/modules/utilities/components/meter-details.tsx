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
type Tab = "breakdown" | "history" | "previous";

export function MeterDetails({ entry }: { entry: Entry }) {
  const [tab, setTab] = React.useState<Tab>("breakdown");
  if (!entry.activeMeter) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Gauge /> Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="meter-details-dialog">
        <DialogHeader>
          <DialogTitle>{entry.room} · Electricity meter</DialogTitle>
          <DialogDescription>
            Monthly usage, reading history, and physical meter lifecycle.
          </DialogDescription>
        </DialogHeader>
        <section className="meter-current-summary">
          <div>
            <span>Current meter</span>
            <strong>
              {entry.activeMeter.meterNumber || "Unnumbered meter"}
            </strong>
            <small>Installed {formatDate(entry.activeMeter.installedAt)}</small>
          </div>
          <div>
            <span>Latest reading</span>
            <strong>
              {entry.activeMeter.latestReading
                ? `${Number(entry.activeMeter.latestReading.readingValue).toLocaleString()} kWh`
                : "—"}
            </strong>
            <small>
              {entry.activeMeter.latestReading
                ? formatDate(entry.activeMeter.latestReading.readingDate)
                : "No readings"}
            </small>
          </div>
          <span className="utility-status is-complete">Active</span>
        </section>
        <div className="meter-detail-actions">
          <MeterReadingDialog
            meterId={entry.activeMeter.id}
            billingMonth={entry.billingMonth.toISOString().slice(0, 7)}
          />
          <ReplaceMeterDialog spaceId={entry.spaceId} />
        </div>
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
          <button
            type="button"
            className={tab === "previous" ? "is-active" : ""}
            onClick={() => setTab("previous")}
          >
            Previous meters
          </button>
        </nav>
        {tab === "breakdown" && <MonthlyBreakdown entry={entry} />}
        {tab === "history" && (
          <MeterHistory
            history={entry.history.filter((meter) => !meter.removedAt)}
          />
        )}
        {tab === "previous" &&
          (entry.history.some((meter) => meter.removedAt) ? (
            <MeterHistory
              history={entry.history.filter((meter) => meter.removedAt)}
            />
          ) : (
            <p className="meter-details-empty">No previous physical meters.</p>
          ))}
      </DialogContent>
    </Dialog>
  );
}

function MonthlyBreakdown({ entry }: { entry: Entry }) {
  const allSegments = entry.tenancySegments;
  const total = allSegments.reduce(
    (sum, segment) => sum + Number(segment.usage),
    0,
  );
  if (entry.attributionStatus !== "READY" || total <= 0) {
    return (
      <div className="meter-breakdown-empty">
        <strong>Monthly attribution is incomplete</strong>
        <p>
          {entry.warnings[0] ||
            "Add the missing monthly or tenancy boundary reading to display the usage chart."}
        </p>
        {entry.missingBoundary.map((boundary) => (
          <BoundaryReadingDialog
            key={`${boundary.tenancyId}-${boundary.boundaryType}`}
            boundary={boundary}
            room={entry.room}
          />
        ))}
      </div>
    );
  }
  return (
    <section className="meter-breakdown">
      <div className="meter-breakdown-total">
        <span>Physical usage</span>
        <strong>
          {entry.meterSegments
            .reduce((sum, meter) => sum + Number(meter.physicalUsage || 0), 0)
            .toLocaleString()}{" "}
          kWh
        </strong>
      </div>
      <div
        className="usage-timeline"
        aria-label="Monthly tenant and vacant electricity usage"
      >
        {allSegments.map((segment, index) => {
          const amount = Number(segment.usage);
          return (
            <div
              key={`${segment.label}-${index}`}
              className={segment.kind === "VACANT" ? "is-vacant" : "is-tenant"}
              style={{
                width: `${Math.max((amount / total) * 100, amount ? 5 : 0)}%`,
              }}
              title={`${segment.label}: ${amount.toLocaleString()} kWh`}
            >
              <span>{segment.label}</span>
              <strong>{amount.toLocaleString()}</strong>
            </div>
          );
        })}
      </div>
      <div className="usage-legend">
        {allSegments.map((segment, index) => (
          <div key={`${segment.label}-legend-${index}`}>
            <span
              className={segment.kind === "VACANT" ? "is-vacant" : "is-tenant"}
            />
            <div>
              <strong>{segment.label}</strong>
              <small>
                {Number(segment.usage).toLocaleString()} kWh ·{" "}
                {formatDate(segment.startDate)} → {formatDate(segment.endDate)}
              </small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
