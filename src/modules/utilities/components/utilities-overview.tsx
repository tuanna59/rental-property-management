import {
  Activity,
  AlertTriangle,
  Droplets,
  Gauge,
  Layers3,
  Zap,
} from "lucide-react";

import { formatVnd } from "@/lib/presentation";

import type { getUtilitiesOverview } from "../server/utility.queries";
import {
  EmptyUtilitiesState,
  MonthSelector,
  UtilityStatusBadge,
} from "./utility-ui";
import { BoundaryReadingDialog } from "./boundary-reading-dialog";
import { WaterBreakdownDialog } from "./water-breakdown-dialog";
import { ElectricityBreakdownDialog } from "./electricity-breakdown-dialog";

type Overview = Awaited<ReturnType<typeof getUtilitiesOverview>>;

export function UtilitiesOverview({
  overview,
  month,
}: {
  overview: Overview;
  month: string;
}) {
  const readingPercent = overview.monthlyClosingsRequired
    ? Math.round(
        (overview.monthlyClosingsRecorded / overview.monthlyClosingsRequired) *
          100,
      )
    : 100;
  const attributionPercent = overview.attributionRequired
    ? Math.round(
        (overview.attributionReady / overview.attributionRequired) * 100,
      )
    : 0;
  const totalPhysicalUsage = overview.electricity.reduce(
    (sum, row) => sum + Number(row.knownPhysicalUsage ?? 0),
    0,
  );
  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">PROPERTY UTILITIES</p>
          <h1>Utilities</h1>
          <p>Track monthly closings, physical usage, attribution, and utility charges.</p>
        </div>
        <MonthSelector month={month} />
      </header>
      <section
        className="summary-grid utility-overview-summary"
        aria-label="Monthly utility summary"
      >
        <SummaryCard
          icon={<Gauge />}
          label="Monthly closings"
          value={`${overview.monthlyClosingsRecorded} / ${overview.monthlyClosingsRequired} required recorded`}
          detail={
            overview.monthlyClosingsNeedsClosing
              ? `${overview.monthlyClosingsNeedsClosing} needs closing · ${overview.monthlyClosingsOptional} optional`
              : `${overview.monthlyClosingsOptional} optional`
          }
          progress={readingPercent}
        />
        <SummaryCard
          icon={<Layers3 />}
          label="Attribution readiness"
          value={`${overview.attributionReady} / ${overview.attributionRequired} ready`}
          detail="Tenant and vacant usage"
          progress={attributionPercent}
        />
        <SummaryCard
          icon={<Zap />}
          label="Known physical usage"
          value={
            totalPhysicalUsage
              ? `${totalPhysicalUsage.toLocaleString()} kWh`
              : "—"
          }
          detail="Known so far across physical meter segments"
        />
        <SummaryCard
          icon={<Droplets />}
          label="Water"
          value={`${overview.water.billablePeople} billable people`}
          detail={`${overview.water.occupantDays} occupant-days${overview.water.calculatedPreviewAmount ? ` · ${formatVnd(overview.water.calculatedPreviewAmount)}` : ""}`}
        />
        <SummaryCard
          icon={<Activity />}
          label="Attention"
          value={`${overview.warnings.length} item${overview.warnings.length === 1 ? "" : "s"}`}
          detail={
            overview.warnings.length
              ? "Readings or boundaries need action"
              : "No utility warnings"
          }
        />
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Monthly room status</h2>
            <p>
              Monthly closing status, known physical usage, and tenant attribution are tracked separately.
            </p>
          </div>
        </div>
        {overview.electricity.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Meter</th>
                  <th>Monthly closing</th>
                  <th>Attribution</th>
                  <th>Known usage</th>
                  <th>Electricity estimate</th>
                  <th>Water estimate</th>
                  <th>Warning</th>
                </tr>
              </thead>
              <tbody>
                {overview.electricity.map((row) => {
                  const closingStatus =
                    row.closingStatus === "LOCKED"
                      ? "locked"
                      : row.closingStatus === "CLOSING_SET"
                        ? "closing-set"
                        : row.closingStatus === "NEEDS_CLOSING"
                          ? "needs-closing"
                          : row.closingStatus === "OPTIONAL"
                            ? "optional"
                            : "n-a";
                  return (
                    <tr key={row.spaceId}>
                      <td>
                        <div className="utility-room">{row.room}</div>
                      </td>
                      <td>{row.meterNumber || "No meter"}</td>
                      <td>
                        <UtilityStatusBadge status={closingStatus} />
                      </td>
                      <td>
                        <UtilityStatusBadge
                          status={
                            row.attributionStatus === "COMPLETE"
                              ? "complete"
                              : "incomplete"
                          }
                        />
                      </td>
                      <td>
                        {row.knownPhysicalUsage !== null
                          ? `${Number(row.knownPhysicalUsage).toLocaleString()} kWh`
                          : "—"}
                        <div className="utility-subtle">
                          {row.monthlyPhysicalUsage !== null
                            ? `Cycle usage ${Number(row.monthlyPhysicalUsage).toLocaleString()} kWh`
                            : row.closingRequired
                              ? "Known so far · closing not ready"
                              : "Known so far · closing optional"}
                        </div>
                      </td>
                      <td>
                        <div className="utility-estimate-cell">
                          <div className="utility-estimate-primary">
                            <strong>
                              {row.preview.finalAmount
                                ? formatVnd(row.preview.finalAmount)
                                : "—"}
                            </strong>
                            <ElectricityBreakdownDialog
                              preview={row.preview}
                              room={row.room}
                            />
                          </div>
                          <div className="utility-subtle">
                            {row.preview.totalAttributableUsage ?? "0"} billable kWh
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="utility-estimate-cell">
                          <div className="utility-estimate-primary">
                            <strong>
                              {row.water.finalPreviewAmount !== null
                                ? formatVnd(row.water.finalPreviewAmount)
                                : "—"}
                            </strong>
                            <WaterBreakdownDialog water={row.water} />
                          </div>
                          <div className="utility-subtle">
                            {row.water.billablePeople} billable people
                          </div>
                        </div>
                      </td>
                      <td className="utility-subtle">
                        {row.warnings[0] ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyUtilitiesState
            title="No rental rooms"
            description="Add rental rooms to begin utility tracking."
          />
        )}
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Needs attention</h2>
            <p>Missing required closings and tenancy boundaries appear here.</p>
          </div>
        </div>
        {overview.warnings.length ? (
          <div className="utility-warning-list">
            {overview.warnings.map((warning, index) => (
              <div
                className="utility-warning"
                key={`${warning.spaceId}-${warning.message}-${index}`}
              >
                <AlertTriangle />
                <span>
                  <strong>{warning.room}</strong> · {warning.message}
                </span>
                {warning.boundary && (
                  <BoundaryReadingDialog
                    boundary={warning.boundary}
                    room={warning.room}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyUtilitiesState
            title="Everything is ready"
            description="There are no utility readings or boundaries requiring attention."
          />
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  progress?: number;
}) {
  return (
    <article className="utility-summary-card">
      <header>
        <span>{label}</span>
        {icon}
      </header>
      <strong>{value}</strong>
      <p>{detail}</p>
      <div
        className={`utility-progress${progress === undefined ? " is-empty" : ""}`}
        aria-hidden={progress === undefined}
      >
        {progress !== undefined && (
          <span style={{ width: `${progress}%` }} />
        )}
      </div>
    </article>
  );
}
