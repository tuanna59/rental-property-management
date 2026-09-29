"use client";

import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthLocale, formatNumberLocale, formatVndLocale } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { getElectricityPreview } from "../server/utility.queries";

type Preview = Awaited<ReturnType<typeof getElectricityPreview>>;

export function ElectricityBreakdownDialog({
  preview,
  room,
}: {
  preview: Preview;
  room: string;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
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
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="utility-estimate-details-trigger"
          aria-label={`${t("viewElectricityDetails")} · ${room}`}
          title={t("viewElectricityDetails")}
        >
          <ChevronRight />
        </Button>
      </DialogTrigger>
      <DialogContent className="electricity-details-dialog">
        <DialogHeader>
          <DialogTitle>{t("electricityDetails", { room })}</DialogTitle>
          <DialogDescription>
            {formatMonthLocale(preview.billingPeriod, locale)}
            {serviceStart && serviceEnd
              ? ` · ${t("serviceRange", { start: formatDateOnlyLocale(serviceStart, locale), end: formatDateOnlyLocale(serviceEnd, locale) })}`
              : ""}
             {t("tenantBillingExcludesVacant")}
          </DialogDescription>
        </DialogHeader>

        <div className="electricity-summary-grid">
          <Info
            label={t("applicableRate")}
            value={`${formatVndLocale(String(rate), locale)} / kWh`}
            detail={
              preview.rateOverridden ? t("roomMonthOverride") : t("snapshotRate")
            }
          />
          <Info
            label={t("physicalUsage")}
            value={`${formatNumberLocale(physicalUsage, locale, { maximumFractionDigits: 2 })} kWh`}
            detail={t("physicalMeters", { count: preview.meterSegments.length })}
          />
          <Info
            label={t("vacantPropertyUsage")}
            value={`${formatNumberLocale(vacantUsage, locale, { maximumFractionDigits: 2 })} kWh`}
            detail={t("notBilled")}
          />
          <Info
            label={t("billableUsage")}
            value={`${formatNumberLocale(billableUsage, locale, { maximumFractionDigits: 2 })} kWh`}
            detail={t("tenantAttributed")}
          />
          <Info
            label={t("calculatedAmount")}
            value={formatVndLocale(String(calculatedAmount), locale)}
            detail={`${formatNumberLocale(billableUsage, locale, { maximumFractionDigits: 2 })} × ${formatNumberLocale(rate, locale, { maximumFractionDigits: 2 })}`}
          />
        </div>

        {preview.rateOverridden && (
          <p className="electricity-override-note">
            {t("rateOverride")} · {preview.overrideReason ?? t("noReasonProvided")}
          </p>
        )}

        <section className="electricity-calculation">
          <h3>{t("calculation")}</h3>
          <CalculationRow
            label={t("physicalUsage")}
            value={`${formatNumberLocale(physicalUsage, locale, { maximumFractionDigits: 2 })} kWh`}
          />
          <CalculationRow
            label={t("lessVacantProperty")}
            value={`−${formatNumberLocale(vacantUsage, locale, { maximumFractionDigits: 2 })} kWh`}
          />
          <CalculationRow
            label={t("billableUsage")}
            value={`${formatNumberLocale(billableUsage, locale, { maximumFractionDigits: 2 })} kWh`}
            strong
          />
          <CalculationRow
            label={t("rate")}
            value={`${formatVndLocale(String(rate), locale)} / kWh`}
          />
          <CalculationRow
            label={t("calculatedAmount")}
            value={formatVndLocale(String(calculatedAmount), locale)}
            strong
          />
        </section>

        {physicalUsage > 0 && (
          <section>
            <h3>{t("usageAllocation")}</h3>
            <div
              className="electricity-allocation-bar"
              aria-label={t("usageAllocationAria")}
            >
              {preview.tenantBreakdown.map((segment, index) => (
                <span
                  className="is-tenant"
                  key={`${segment.tenancyId}-${index}`}
                  style={{
                    width: `${(Number(segment.usage) / physicalUsage) * 100}%`,
                  }}
                  title={`${segment.tenantName}: ${formatNumberLocale(segment.usage, locale, { maximumFractionDigits: 2 })} kWh`}
                />
              ))}
              {vacantUsage > 0 && (
                <span
                  className="is-vacant"
                  style={{ width: `${(vacantUsage / physicalUsage) * 100}%` }}
                  title={`${t("vacantPropertyUsage")}: ${formatNumberLocale(vacantUsage, locale, { maximumFractionDigits: 2 })} kWh`}
                />
              )}
            </div>
          </section>
        )}

        <section>
          <h3>{t("attribution")}</h3>
          <div className="utility-table-wrap">
            <table className="utility-table electricity-details-table">
              <thead>
                <tr>
                  <th>{t("tenant")}</th>
                  <th>{t("servicePeriod")}</th>
                  <th>{t("billableUsage")}</th>
                  <th>{t("share")}</th>
                  <th>{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.tenantBreakdown.map((segment, index) => (
                  <tr key={`${segment.tenancyId}-${index}`}>
                    <td>
                      <strong>{segment.tenantName}</strong>
                    </td>
                    <td>
                      {formatDateOnlyLocale(segment.startDate, locale)} →{" "}
                      {formatDateOnlyLocale(segment.endDate, locale)}
                    </td>
                    <td>{formatNumberLocale(segment.usage, locale, { maximumFractionDigits: 2 })} kWh</td>
                    <td>{segment.share}%</td>
                    <td>{segment.amount ? formatVndLocale(segment.amount, locale) : "—"}</td>
                  </tr>
                ))}
                {vacantUsage > 0 && (
                  <tr className="is-vacant-row">
                    <td>
                      <strong>{t("vacantPropertyUsage")}</strong>
                    </td>
                    <td>{t("unoccupiedServiceTime")}</td>
                    <td>{formatNumberLocale(vacantUsage, locale, { maximumFractionDigits: 2 })} kWh</td>
                    <td>—</td>
                    <td>{t("notBilled")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3>{t("physicalMeterEvidence")}</h3>
          <div className="utility-table-wrap">
            <table className="utility-table electricity-details-table">
              <thead>
                <tr>
                  <th>{t("meter")}</th>
                  <th>{t("previousAnchor")}</th>
                  <th>{t("monthlyClosing")}</th>
                  <th>{t("knownEndBoundary")}</th>
                  <th>{t("cycleUsageLabel")}</th>
                  <th>{t("knownUsage")}</th>
                  <th>{t("evidence")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.meterSegments.map((meter) => (
                  <tr key={meter.meterId}>
                    <td>
                      <strong>{meter.meterNumber || t("unnumberedMeter")}</strong>
                    </td>
                    <td>{reading(meter.openingReading, locale, t)}</td>
                    <td>{reading(meter.monthlyClosingReading, locale, t)}</td>
                    <td>{reading(meter.knownEndReading, locale, t)}</td>
                    <td>
                      {meter.physicalUsage === null
                        ? t("unavailable")
                        : `${formatNumberLocale(meter.physicalUsage, locale, { maximumFractionDigits: 2 })} kWh`}
                    </td>
                    <td>
                      {meter.knownPhysicalUsage === null
                        ? t("unavailable")
                        : `${formatNumberLocale(meter.knownPhysicalUsage, locale, { maximumFractionDigits: 2 })} kWh`}
                    </td>
                    <td>
                      {meter.hasEstimatedReading ? t("estimated") : t("measured")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="electricity-details-notes">
          <span>
            {t("vacantExcluded")}
          </span>
          <span>{t("invoiceUsesRateSnapshot")}</span>
          <span>{t("readOnly")}</span>
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

function reading(
  value: Preview["meterSegments"][number]["openingReading"],
  locale: AppLocale,
  t: ReturnType<typeof useTranslations>,
) {
  return value
    ? `${formatNumberLocale(value.readingValue, locale, { maximumFractionDigits: 2 })} kWh · ${formatDateOnlyLocale(value.readingDate, locale)}`
    : t("unavailable");
}
