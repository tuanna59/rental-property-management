"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthShortLocale, formatNumberLocale } from "@/i18n/format";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivateAttachmentPicker } from "@/components/ui/private-attachment";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { emptyActionState } from "@/lib/action-state";
import { appendMeterReadingPhotoAction } from "../actions";
import { EditMeterReadingDialog } from "./edit-meter-reading-dialog";

type History = Awaited<
  ReturnType<typeof import("../server/utility.queries").getSpaceMeterHistory>
>;
type MeterHistoryItem = History[number];
type Reading = MeterHistoryItem["readings"][number];

export function MeterHistory({
  history,
  readOnly = false,
}: {
  history: History;
  readOnly?: boolean;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  if (!history.length) {
    return <p className="meter-details-empty">{t("noMeterReadings")}</p>;
  }

  return (
    <section className="meter-history-list">
      {history.map((meter, index) => {
        const retired = Boolean(meter.removedAt);
        const replacementDate = history[index - 1]?.installedAt ?? null;
        const card = (
          <MeterHistoryCard
            meter={meter}
            retired={retired}
            readOnly={readOnly || retired}
          />
        );

        return (
          <React.Fragment key={meter.id}>
            {replacementDate && (
              <div className="meter-replacement-divider">
                {t("meterReplaced", { date: formatDateOnlyLocale(replacementDate, locale) })}
              </div>
            )}
            {retired ? (
              <details className="meter-history-collapsible">{card}</details>
            ) : (
              <article className="meter-history-group">{card}</article>
            )}
          </React.Fragment>
        );
      })}
    </section>
  );
}

function MeterHistoryCard({
  meter,
  retired,
  readOnly,
}: {
  meter: MeterHistoryItem;
  retired: boolean;
  readOnly: boolean;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  const heading = (
    <div className="meter-history-heading">
      <div>
        <h3>{meter.meterNumber || t("unnumberedMeter")}</h3>
        <p className="utility-subtle">
          {retired
            ? `${formatDateOnlyLocale(meter.installedAt, locale)} → ${formatDateOnlyLocale(meter.removedAt!, locale)}`
            : t("installed", { date: formatDateOnlyLocale(meter.installedAt, locale) })}
        </p>
      </div>
      <span
        className={`utility-status ${retired ? "is-estimated" : "is-complete"}`}
      >
        {retired ? t("retired") : t("active")}
      </span>
    </div>
  );

  return (
    <>
      {retired ? <summary>{heading}</summary> : heading}
      <div className="utility-table-wrap">
        <table className="utility-table meter-history-table">
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("reading")}</th>
              <th>{t("type")}</th>
              <th>{t("role")}</th>
              <th>{t("evidence")}</th>
              <th>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {meter.readings.map((reading) => (
              <tr key={reading.id}>
                <td>{formatDateOnlyLocale(reading.readingDate, locale)}</td>
                <td>
                  <strong>
                    {formatNumberLocale(reading.readingValue, locale)} kWh
                  </strong>
                </td>
                <td>{readingTypeLabel(reading.readingType, t)}</td>
                <td>
                  <div className="meter-reading-role">
                    <span>{readingRole(reading, locale, t)}</span>
                    {reading.isLocked && (
                      <span className="utility-status is-incomplete">{t("locked")}</span>
                    )}
                  </div>
                </td>
                <td>
                  <PhotoDialog
                    meterId={meter.id}
                    readingId={reading.id}
                    count={reading.photoCount}
                    readOnly={readOnly || reading.isLocked || reading.isManaged}
                  />
                </td>
                <td>
                  {!readOnly && !reading.isManaged && !reading.isLocked ? (
                    <EditMeterReadingDialog
                      meterNumber={meter.meterNumber}
                      reading={reading}
                    />
                  ) : (
                    <Button type="button" size="sm" variant="ghost" disabled>
                      {t("view")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function readingTypeLabel(readingType: Reading["readingType"], t: ReturnType<typeof useTranslations>) {
  return {
    MONTHLY: t("legacyMonthlyReading"),
    MOVE_IN: t("moveIn"),
    MOVE_OUT: t("moveOut"),
    MANUAL: t("manualReading"),
    METER_INSTALL: t("meterInstalled"),
    METER_REMOVAL: t("meterRemoved"),
  }[readingType];
}

function readingRole(reading: Reading, locale: AppLocale, t: ReturnType<typeof useTranslations>) {
  if (reading.isClosing && reading.billingMonth) {
    return t("closingForMonth", { month: formatMonthShortLocale(reading.billingMonth, locale) });
  }
  if (reading.readingType === "MOVE_IN" || reading.readingType === "MOVE_OUT") {
    return t("tenantBoundary");
  }
  if (reading.readingType === "METER_INSTALL" || reading.readingType === "METER_REMOVAL") {
    return t("lifecycleEvent");
  }
  return "—";
}

function PhotoDialog({
  meterId,
  readingId,
  count,
  readOnly = false,
}: {
  meterId: string;
  readingId: string;
  count: number;
  readOnly?: boolean;
}) {
  const t = useTranslations("utilities");
  const [open, setOpen] = React.useState(false);
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [state, action] = React.useActionState(
    appendMeterReadingPhotoAction,
    emptyActionState,
  );
  const currentIndex = Math.min(photoIndex, Math.max(count - 1, 0));

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setPhotoIndex(0);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={readOnly && count === 0}
        >
          <ImageIcon />{" "}
          {count
            ? t("photos", { count })
            : readOnly
              ? t("noPhotoShort")
              : t("addPhoto")}
        </Button>
      </DialogTrigger>
      <DialogContent className="media-preview-dialog">
        <DialogHeader>
          <DialogTitle>{t("meterReadingEvidence")}</DialogTitle>
        </DialogHeader>
        {count > 0 && (
          <div className="meter-evidence-gallery">
            <div className="meter-evidence-stage">
              <img
                key={currentIndex}
                src={`/api/meters/${meterId}/media/${readingId}?index=${currentIndex}`}
                alt={t("evidenceAlt", { current: currentIndex + 1, count })}
              />
            </div>
            {count > 1 && (
              <div className="meter-evidence-nav" aria-label={t("evidencePhotoNavigation")}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t("previousEvidence")}
                  disabled={currentIndex === 0}
                  onClick={() => setPhotoIndex((value) => Math.max(0, value - 1))}
                >
                  <ChevronLeft />
                </Button>
                <span>{currentIndex + 1} / {count}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t("nextEvidence")}
                  disabled={currentIndex >= count - 1}
                  onClick={() =>
                    setPhotoIndex((value) => Math.min(count - 1, value + 1))
                  }
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        )}
        {!readOnly && (
          <PreservingActionForm action={action} className="dialog-form">
            <input type="hidden" name="readingId" value={readingId} />
            <PrivateAttachmentPicker
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              title={t("evidencePhoto")}
              emptyText={t("noPhoto")}
              actionLabel={t("choosePhoto")}
              kind="image"
            />
            {state.message && (
              <p className={state.ok ? "form-success" : "form-error"}>
                {state.message}
              </p>
            )}
            <Button type="submit">{t("addEvidencePhoto")}</Button>
          </PreservingActionForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

