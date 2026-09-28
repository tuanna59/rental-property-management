"use client";

import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, formatVnd } from "@/lib/presentation";
import type { getElectricityPreview } from "../server/utility.queries";

type Preview = Awaited<ReturnType<typeof getElectricityPreview>>;

export function ElectricityBreakdownDialog({
  preview,
  room,
}: {
  preview: Preview;
  room: string;
}) {
  if (preview.completeness !== "COMPLETE") return null;

  const physicalUsage = Number(preview.totalPhysicalUsage ?? 0);
  const billableUsage = Number(preview.totalAttributableUsage ?? 0);
  const vacantUsage = Number(preview.vacantUsage ?? 0);
  const rate = Number(preview.applicableRate ?? 0);
  const calculatedAmount = Number(preview.calculatedAmount ?? 0);
  const serviceStarts = preview.tenantBreakdown.map((item) => item.startDate);
  const serviceEnds = preview.tenantBreakdown.map((item) => item.endDate);
  const serviceStart = serviceStarts.sort(
    (left, right) => left.getTime() - right.getTime(),
  )[0];
  const serviceEnd = serviceEnds.sort(
    (left, right) => right.getTime() - left.getTime(),
  )[0];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <Zap /> Details
        </Button>
      </DialogTrigger>
      <DialogContent className="electricity-details-dialog">
        <DialogHeader>
          <DialogTitle>Electricity details · {room}</DialogTitle>
          <DialogDescription>
            {monthLabel(preview.billingPeriod)}
            {serviceStart && serviceEnd
              ? ` · Service ${formatDate(serviceStart)} → ${formatDate(serviceEnd)}`
              : ""}
            . Tenant billing excludes vacant/property usage.
          </DialogDescription>
        </DialogHeader>

        <div className="electricity-summary-grid">
          <Info
            label="Applicable rate"
            value={`${formatVnd(String(rate))} / kWh`}
            detail={
              preview.rateOverridden ? "Room/month override" : "Snapshot rate"
            }
          />
          <Info
            label="Physical usage"
            value={`${number(physicalUsage)} kWh`}
            detail={`Across ${preview.meterSegments.length} physical ${preview.meterSegments.length === 1 ? "meter" : "meters"}`}
          />
          <Info
            label="Vacant / property usage"
            value={`${number(vacantUsage)} kWh`}
            detail="Not billed"
          />
          <Info
            label="Billable usage"
            value={`${number(billableUsage)} kWh`}
            detail="Tenant attributed"
          />
          <Info
            label="Calculated amount"
            value={formatVnd(String(calculatedAmount))}
            detail={`${number(billableUsage)} × ${number(rate)}`}
          />
        </div>

        {preview.rateOverridden && (
          <p className="electricity-override-note">
            Rate override · {preview.overrideReason ?? "No reason provided"}
          </p>
        )}

        <section className="electricity-calculation">
          <h3>Calculation</h3>
          <CalculationRow
            label="Physical usage"
            value={`${number(physicalUsage)} kWh`}
          />
          <CalculationRow
            label="Less vacant / property usage"
            value={`−${number(vacantUsage)} kWh`}
          />
          <CalculationRow
            label="Billable usage"
            value={`${number(billableUsage)} kWh`}
            strong
          />
          <CalculationRow
            label="Rate"
            value={`${formatVnd(String(rate))} / kWh`}
          />
          <CalculationRow
            label="Calculated amount"
            value={formatVnd(String(calculatedAmount))}
            strong
          />
        </section>

        {physicalUsage > 0 && (
          <section>
            <h3>Usage allocation</h3>
            <div
              className="electricity-allocation-bar"
              aria-label="Electricity usage allocation"
            >
              {preview.tenantBreakdown.map((segment, index) => (
                <span
                  className="is-tenant"
                  key={`${segment.tenancyId}-${index}`}
                  style={{
                    width: `${(Number(segment.usage) / physicalUsage) * 100}%`,
                  }}
                  title={`${segment.tenantName}: ${number(segment.usage)} kWh`}
                />
              ))}
              {vacantUsage > 0 && (
                <span
                  className="is-vacant"
                  style={{ width: `${(vacantUsage / physicalUsage) * 100}%` }}
                  title={`Vacant / property: ${number(vacantUsage)} kWh`}
                />
              )}
            </div>
          </section>
        )}

        <section>
          <h3>Tenant attribution</h3>
          <div className="utility-table-wrap">
            <table className="utility-table electricity-details-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Service period</th>
                  <th>Billable usage</th>
                  <th>Share</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.tenantBreakdown.map((segment, index) => (
                  <tr key={`${segment.tenancyId}-${index}`}>
                    <td>
                      <strong>{segment.tenantName}</strong>
                    </td>
                    <td>
                      {formatDate(segment.startDate)} →{" "}
                      {formatDate(segment.endDate)}
                    </td>
                    <td>{number(segment.usage)} kWh</td>
                    <td>{segment.share}%</td>
                    <td>{segment.amount ? formatVnd(segment.amount) : "—"}</td>
                  </tr>
                ))}
                {vacantUsage > 0 && (
                  <tr className="is-vacant-row">
                    <td>
                      <strong>Vacant / property</strong>
                    </td>
                    <td>Unoccupied service time</td>
                    <td>{number(vacantUsage)} kWh</td>
                    <td>—</td>
                    <td>Not billed</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3>Physical meter evidence</h3>
          <div className="utility-table-wrap">
            <table className="utility-table electricity-details-table">
              <thead>
                <tr>
                  <th>Meter</th>
                  <th>Previous anchor</th>
                  <th>Monthly closing</th>
                  <th>Known end / boundary</th>
                  <th>Cycle usage</th>
                  <th>Known usage</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {preview.meterSegments.map((meter) => (
                  <tr key={meter.meterId}>
                    <td>
                      <strong>{meter.meterNumber || "Unnumbered meter"}</strong>
                    </td>
                    <td>{reading(meter.openingReading)}</td>
                    <td>{reading(meter.monthlyClosingReading)}</td>
                    <td>{reading(meter.knownEndReading)}</td>
                    <td>
                      {meter.physicalUsage === null
                        ? "Unavailable"
                        : `${number(meter.physicalUsage)} kWh`}
                    </td>
                    <td>
                      {meter.knownPhysicalUsage === null
                        ? "Unavailable"
                        : `${number(meter.knownPhysicalUsage)} kWh`}
                    </td>
                    <td>
                      {meter.hasEstimatedReading ? "Estimated" : "Measured"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="electricity-details-notes">
          <span>
            Vacant/property electricity is excluded from tenant billing.
          </span>
          <span>The invoice uses the applicable rate snapshot.</span>
          <span>This view is read-only.</span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Info({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function CalculationRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? "is-strong" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function reading(value: Preview["meterSegments"][number]["openingReading"]) {
  return value
    ? `${number(value.readingValue)} kWh · ${formatDate(value.readingDate)}`
    : "Unavailable";
}

function number(value: string | number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}
