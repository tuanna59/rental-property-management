"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatNumberLocale, formatVndLocale } from "@/i18n/format";

import {
  Activity,
  AlertTriangle,
  Droplets,
  Gauge,
  Layers3,
  Zap,
} from "lucide-react";

import type { getUtilitiesOverview } from "../server/utility.queries";
import {
  EmptyUtilitiesState,
  MonthSelector,
  UtilityStatusBadge,
} from "./utility-ui";
import { BoundaryReadingDialog } from "./boundary-reading-dialog";
import { WaterBreakdownDialog } from "./water-breakdown-dialog";
import { ElectricityBreakdownDialog } from "./electricity-breakdown-dialog";
import { translateUtilityWarning } from "./utility-presentation";

type Overview = Awaited<ReturnType<typeof getUtilitiesOverview>>;

export function UtilitiesOverview({
  overview,
  month,
}: {
  overview: Overview;
  month: string;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
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
          <p className="utilities-eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <MonthSelector month={month} />
      </header>
      <section
        className="summary-grid utility-overview-summary"
        aria-label={t("monthlySummary")}
      >
        <SummaryCard
          icon={<Gauge />}
          label={t("monthlyClosings")}
          value={t("closingsRecorded", { recorded: overview.monthlyClosingsRecorded, required: overview.monthlyClosingsRequired })}
          detail={
            overview.monthlyClosingsNeedsClosing
              ? t("closingDetail", { needs: overview.monthlyClosingsNeedsClosing, optional: overview.monthlyClosingsOptional })
              : t("optionalCount", { count: overview.monthlyClosingsOptional })
          }
          progress={readingPercent}
        />
        <SummaryCard
          icon={<Layers3 />}
          label={t("attributionReadiness")}
          value={t("readyCount", { ready: overview.attributionReady, required: overview.attributionRequired })}
          detail={t("tenantVacantUsage")}
          progress={attributionPercent}
        />
        <SummaryCard
          icon={<Zap />}
          label={t("knownPhysicalUsage")}
          value={
            totalPhysicalUsage
              ? `${formatNumberLocale(totalPhysicalUsage, locale)} kWh`
              : "—"
          }
          detail={t("knownPhysicalUsageDetail")}
        />
        <SummaryCard
          icon={<Droplets />}
          label={t("water")}
          value={t("billablePeople", { count: overview.water.billablePeople })}
          detail={`${t("occupantDays", { count: overview.water.occupantDays })}${overview.water.calculatedPreviewAmount ? ` · ${formatVndLocale(overview.water.calculatedPreviewAmount, locale)}` : ""}`}
        />
        <SummaryCard
          icon={<Activity />}
          label={t("attention")}
          value={t("attentionItems", { count: overview.warnings.length })}
          detail={
            overview.warnings.length
              ? t("attentionNeedsAction")
              : t("noWarnings")
          }
        />
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("monthlyRoomStatus")}</h2>
            <p>
              {t("monthlyRoomSubtitle")}
            </p>
          </div>
        </div>
        {overview.electricity.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>{t("room")}</th>
                  <th>{t("meter")}</th>
                  <th>{t("monthlyClosing")}</th>
                  <th>{t("attribution")}</th>
                  <th>{t("knownUsage")}</th>
                  <th>{t("electricityEstimate")}</th>
                  <th>{t("waterEstimate")}</th>
                  <th>{t("warning")}</th>
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
                      <td>{row.meterNumber || t("noMeter")}</td>
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
                          ? `${formatNumberLocale(row.knownPhysicalUsage, locale)} kWh`
                          : "—"}
                        <div className="utility-subtle">
                          {row.monthlyPhysicalUsage !== null
                            ? t("cycleUsage", { value: formatNumberLocale(row.monthlyPhysicalUsage, locale) })
                            : row.closingRequired
                              ? t("knownClosingNotReady")
                              : t("knownClosingOptional")}
                        </div>
                      </td>
                      <td>
                        <div className="utility-estimate-cell">
                          <div className="utility-estimate-primary">
                            <strong>
                              {row.preview.finalAmount
                                ? formatVndLocale(row.preview.finalAmount, locale)
                                : "—"}
                            </strong>
                            <ElectricityBreakdownDialog
                              preview={row.preview}
                              room={row.room}
                            />
                          </div>
                          <div className="utility-subtle">
                            {t("billableKwh", { value: row.preview.totalAttributableUsage ?? "0" })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="utility-estimate-cell">
                          <div className="utility-estimate-primary">
                            <strong>
                              {row.water.finalPreviewAmount !== null
                                ? formatVndLocale(row.water.finalPreviewAmount, locale)
                                : "—"}
                            </strong>
                            <WaterBreakdownDialog water={row.water} />
                          </div>
                          <div className="utility-subtle">
                            {t("billablePeople", { count: row.water.billablePeople })}
                          </div>
                        </div>
                      </td>
                      <td className="utility-subtle">
                        {row.warnings[0] ? translateUtilityWarning(row.warnings[0], t, locale) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyUtilitiesState
            title={t("noRentalRooms")}
            description={t("addRentalRooms")}
          />
        )}
      </section>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("needsAttention")}</h2>
            <p>{t("needsAttentionSubtitle")}</p>
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
                  <strong>{warning.room}</strong> · {translateUtilityWarning(warning.message, t, locale)}
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
            title={t("everythingReady")}
            description={t("everythingReadyDetail")}
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
