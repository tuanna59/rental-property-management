"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Eye,
  Gauge,
  History,
  Image as ImageIcon,
  Info,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivateAttachmentPicker } from "@/components/ui/private-attachment";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import type { AppLocale } from "@/i18n/config";
import { formatCompactDateLocale, formatMonthLocale, formatMonthShortLocale, formatNumberLocale } from "@/i18n/format";
import {
  appendMeterReadingPhotoAction,
  installMeterAction,
  markAllEligibleMonthlyClosingsAction,
  markReadingAsMonthlyClosingAction,
  recordReadingAction,
} from "../actions";
import type { getMonthlyMeterEntries } from "../server/utility.queries";
import { MeterDetails } from "./meter-details";
import { EmptyUtilitiesState, MonthSelector } from "./utility-ui";

type Entries = Awaited<ReturnType<typeof getMonthlyMeterEntries>>;
type Filter = "ALL" | "OPEN" | "CLOSED";
type RowOverlay = "OPTIONS" | "PHOTO" | "HISTORY" | "MANAGE";

export function MonthlyMeterEntry({
  entries,
  month,
  propertyId,
}: {
  entries: Entries;
  month: string;
  propertyId: string;
}) {
  const t = useTranslations("utilities");
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get("month");
  const selectedMonth = validMonth(urlMonth) ? urlMonth : month;
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const openRows = entries.filter(
    (entry) =>
      Boolean(entry.activeMeter) &&
      entry.closingRequired &&
      !entry.closingLocked,
  );
  const closedRows = entries.filter(
    (entry) => entry.closingLocked || entry.closingStatus === "LOCKED",
  );
  const visible =
    filter === "OPEN" ? openRows : filter === "CLOSED" ? closedRows : entries;
  const bulkRows = entries.flatMap((entry) => {
    if (
      !entry.closingRequired ||
      !entry.activeMeter ||
      !entry.closingCandidate ||
      entry.closingLocked
    ) {
      return [];
    }
    if (entry.monthlyReading?.id === entry.closingCandidate.id) return [];
    return [
      {
        room: entry.room,
        meterId: entry.activeMeter.id,
        readingId: entry.closingCandidate.id,
        readingValue: entry.closingCandidate.readingValue,
        readingDate: entry.closingCandidate.readingDate,
      },
    ];
  });

  return (
    <div className="utilities-content">
      <header className="utilities-header meter-fast-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">{t("meterReadingsEyebrow")}</p>
          <h1>{t("meterReadingsTitle")}</h1>
<p>{t("meterReadingsSubtitle")}</p>
        </div>
        <MonthSelector month={selectedMonth} />
      </header>
      <section className="utility-section meter-fast-section">
        <div className="utility-section-header meter-fast-toolbar">
          <div className="meter-toolbar-primary">
            <div
              className="meter-filter-group"
              aria-label={t("billingMonthFilter")}
            >
              {(
                [
                  ["ALL", t("all"), entries.length],
                  ["OPEN", t("open"), openRows.length],
                  ["CLOSED", t("closed"), closedRows.length],
                ] as const
              ).map(([value, label, count]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label} <span>{count}</span>
              </button>
              ))}
            </div>
          </div>
          {bulkRows.length > 0 && (
            <BulkClosingDialog
              propertyId={propertyId}
              month={selectedMonth}
              rows={bulkRows}
            />
          )}
        </div>
        {visible.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table meter-fast-grid">
              <thead>
                <tr>
                  <th>{t("roomMeter")}</th>
                  <th>{t("previousClosing")}</th>
                  <th>{t("latestReading")}</th>
                  <th>{t("newReading")}</th>
                  <th>{t("readingDate")}</th>
                  <th>{t("knownUsage")}</th>
                  <th>{t("status")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) =>
                  entry.activeMeter ? (
                    <MeterEntryRow
                      key={entry.spaceId}
                      entry={entry}
                      month={selectedMonth}
                    />
                  ) : (
                    <NoMeterRow key={entry.spaceId} entry={entry} />
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyUtilitiesState
            title={t("noRoomsInView")}
            description={t("chooseAnotherFilter")}
          />
        )}
      </section>
      <p className="meter-grid-note">
        <Gauge /> {t("meterGridNote")}
      </p>
    </div>
  );
}

function MeterEntryRow({
  entry,
  month,
}: {
  entry: Entries[number];
  month: string;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  const meter = entry.activeMeter;
  if (!meter) return null;
  const formId = React.useId();
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(
    "MEASURED",
  );
  const [reason, setReason] = React.useState("");
  const [state, saveAction, pending] = React.useActionState(
    recordReadingAction,
    emptyActionState,
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [overlay, setOverlay] = React.useState<RowOverlay | null>(null);
  const candidate = entry.closingCandidate;
  const locked = entry.closingLocked || entry.closingStatus === "LOCKED";
  const minimumReadingDate = entry.manualReadingMinDate
    ? dateOnly(entry.manualReadingMinDate)
    : dateOnly(meter.installedAt);
  const openOverlay = (next: RowOverlay) => {
    setMenuOpen(false);
    window.setTimeout(() => setOverlay(next), 0);
  };

  return (
    <tr className={locked ? "is-locked-meter-row" : undefined}>
      <td className="meter-col-room">
        <div className="meter-identity">
          <strong>{entry.room}</strong>
          <div className="meter-identity-meta">
            <span>
              {entry.floorName} · {entry.meterNumber || t("unnumbered")}
            </span>
            {entry.meterReplacementDuringMonth && (
              <span
                className="meter-replacement-indicator"
                tabIndex={0}
                aria-label={t("meterReplacedThisMonth")}
                data-tooltip={t("meterReplacedThisMonth")}
              >
                <Info aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="meter-col-previous">
        <span className="meter-mobile-label">{t("previousClosing")}</span>
        {entry.previousClosingReading ? (
          <>
            <strong>
              {formatNumberLocale(entry.previousClosingReading.readingValue, locale)} kWh
            </strong>
            <div className="utility-subtle">
              {formatCompactDateLocale(entry.previousClosingReading.readingDate, locale)}
            </div>
          </>
        ) : (
          <>
            <strong>—</strong>
            {entry.activeMeterIsNewThisMonth && (
              <div className="utility-subtle">{t("newMeter")}</div>
            )}
          </>
        )}
      </td>
      <td className="meter-col-latest">
        <span className="meter-mobile-label">{t("latestReading")}</span>
        <LatestReading entry={entry} />
      </td>
      <td className="meter-col-new-reading">
        <span className="meter-mobile-label">{t("newReading")}</span>
        {locked ? (
          <strong>—</strong>
        ) : (
          <form id={formId} action={saveAction} className="meter-inline-form">
            <input type="hidden" name="meterId" value={meter.id} />
            <input type="hidden" name="billingMonth" value={`${month}-01`} />
            <input type="hidden" name="source" value={source} />
            <input type="hidden" name="reason" value={reason} />
            <div className="meter-reading-value-input">
              <Input
                name="readingValue"
                type="number"
                step="0.001"
                required
              />
              <span>kWh</span>
            </div>
            {state.message && (
              <small className={state.ok ? "form-success" : "form-error"}>
                {state.message}
              </small>
            )}
          </form>
        )}
      </td>
      <td className="meter-col-reading-date">
        <span className="meter-mobile-label">{t("readingDate")}</span>
        {locked ? (
          <strong>—</strong>
        ) : (
          <Input
            form={formId}
            name="readingDate"
            type="date"
            min={minimumReadingDate}
            max={todayDate()}
            defaultValue={todayDate()}
            required
          />
        )}
      </td>
      <td className="meter-col-usage">
        <span className="meter-mobile-label">{t("knownUsage")}</span>
        <strong>
          {entry.knownPhysicalUsage !== null
            ? `${formatNumberLocale(entry.knownPhysicalUsage, locale)} kWh`
            : "—"}
        </strong>
        {entry.knownUsageMeterCount > 1 && (
          <div className="utility-subtle">{t("metersCount", { count: entry.knownUsageMeterCount })}</div>
        )}
        {!locked && source === "ESTIMATED" && (
          <div className="utility-status is-estimated">{t("estimatedInput")}</div>
        )}
      </td>
      <td className="meter-col-status">
        <MeterWorkflowStatus entry={entry} month={month} />
      </td>
      <td className="meter-col-actions">
        <div className="meter-row-actions meter-primary-actions">
          {locked ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => openOverlay("MANAGE")}
            >
              View
            </Button>
          ) : (
            <>
              <Button form={formId} type="submit" size="sm" disabled={pending}>
                Save
              </Button>
              <OverflowMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <button type="button" onClick={() => openOverlay("MANAGE")}>
                  <Eye aria-hidden="true" />
                  {t("viewDetails")}
                </button>
                {candidate && (
                  <ClosingAction
                    meterId={meter.id}
                    readingId={candidate.id}
                    month={month}
                    onSelect={() => setMenuOpen(false)}
                  />
                )}
                <button type="button" onClick={() => openOverlay("OPTIONS")}>
                  <SlidersHorizontal aria-hidden="true" />
                  {t("readingOptions")}
                </button>
                {candidate ? (
                  <button type="button" onClick={() => openOverlay("PHOTO")}>
                    <ImageIcon aria-hidden="true" />
                    {candidate.hasPhoto ? t("addViewPhoto") : t("addPhoto")}
                  </button>
                ) : (
                  <span className="disabled-menu-item">{t("addPhotoAfterSaving")}</span>
                )}
                <button type="button" onClick={() => openOverlay("HISTORY")}>
                  <History aria-hidden="true" />
                  {t("viewReadingHistory")}
                </button>
              </OverflowMenu>
            </>
          )}
        </div>
        {!locked && (
          <ReadingOptions
            open={overlay === "OPTIONS"}
            onOpenChange={(open) => !open && setOverlay(null)}
            source={source}
            reason={reason}
            onChange={(nextSource, nextReason) => {
              setSource(nextSource);
              setReason(nextReason);
              setOverlay(null);
            }}
          />
        )}
        {!locked && candidate && (
          <PhotoAction
            open={overlay === "PHOTO"}
            onOpenChange={(open) => !open && setOverlay(null)}
            meterId={meter.id}
            readingId={candidate.id}
            photoCount={candidate.photoCount}
          />
        )}
        <MeterDetails
          entry={entry}
          initialTab="history"
          open={overlay === "HISTORY"}
          onOpenChange={(open) => !open && setOverlay(null)}
          hideTrigger
          readOnly={locked}
        />
        <MeterDetails
          entry={entry}
          open={overlay === "MANAGE"}
          onOpenChange={(open) => !open && setOverlay(null)}
          hideTrigger
          readOnly={locked}
        />
      </td>
    </tr>
  );
}

function LatestReading({ entry }: { entry: Entries[number] }) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  const latest = entry.latestReading;
  if (!latest) return <span className="utility-subtle">{t("noReading")}</span>;

  return (
    <div className="meter-reading-plain">
      <strong>{formatNumberLocale(latest.readingValue, locale)} kWh</strong>
      <span>{formatCompactDateLocale(latest.readingDate, locale)}</span>
    </div>
  );
}

function MeterWorkflowStatus({
  entry,
  month,
}: {
  entry: Entries[number];
  month?: string;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  if (!entry.activeMeter) {
    return (
      <div className="meter-workflow-status">
        <span className="utility-status is-estimated">{t("noMeter")}</span>
      </div>
    );
  }

  const closingMonth = month ? formatMonthShortLocale(`${month}-01`, locale) : null;
  const qualityText =
    entry.closingDateQuality === "EARLY"
      ? t("early")
      : entry.closingDateQuality === "LATE" ||
          entry.closingDateQuality === "VERY_LATE"
        ? entry.closingDateOffsetDays == null
          ? t("lateClosing")
          : t("lateDays", { days: entry.closingDateOffsetDays })
        : null;

  if (entry.closingLocked || entry.closingStatus === "LOCKED") {
    const detail = entry.monthlyReading && closingMonth
      ? [t("closingForMonth", { month: closingMonth }), t("locked"), qualityText].filter(Boolean).join(" · ")
      : t("billingPeriodLocked");
    return (
      <div className="meter-workflow-status">
        <span className="utility-status is-complete">{t("closed")}</span>
        <span>{detail}</span>
      </div>
    );
  }

  if (!entry.closingRequired || entry.closingStatus === "OPTIONAL") {
    return (
      <div className="meter-workflow-status">
        <span className="utility-status is-estimated">{t("optional")}</span>
        <span>{t("closingNotRequired")}</span>
      </div>
    );
  }

  const detail = entry.monthlyReading && closingMonth
    ? [t("closingForMonth", { month: closingMonth }), qualityText].filter(Boolean).join(" · ")
    : t("closingRequired");

  return (
    <div className="meter-workflow-status">
      <span className="utility-status is-missing">{t("open")}</span>
      <span>{detail}</span>
    </div>
  );
}

function BulkClosingDialog({
  propertyId,
  month,
  rows,
}: {
  propertyId: string;
  month: string;
  rows: Array<{
    room: string;
    meterId: string;
    readingId: string;
    readingValue: string;
    readingDate: Date;
  }>;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await markAllEligibleMonthlyClosingsAction(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );
  const assignments = rows.map(({ meterId, readingId }) => ({
    meterId,
    readingId,
  }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          {t("setCurrentReadingsAsClosing", { count: rows.length })}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("setReadingsAsClosingsTitle", { count: rows.length, month: formatMonthLocale(`${month}-01`, locale) })}
          </DialogTitle>
          <DialogDescription>{t("setClosingsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="bulk-closing-list">
          {rows.map((row) => (
            <div key={`${row.meterId}-${row.readingId}`}>
              <strong>{row.room}</strong>
              <span>
                {formatNumberLocale(row.readingValue, locale)} kWh · {formatCompactDateLocale(row.readingDate, locale)}
              </span>
            </div>
          ))}
        </div>
        <PreservingActionForm action={action}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="billingMonth" value={`${month}-01`} />
          <input
            type="hidden"
            name="assignments"
            value={JSON.stringify(assignments)}
          />
          {state.message && !state.ok && (
            <p className="form-error">{state.message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Set closings
            </Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function OverflowMenu({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("utilities");
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 224;
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(
        8,
        Math.min(rect.right - width, window.innerWidth - width - 8),
      ),
    });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      const node = event.target as Node;
      if (
        !triggerRef.current?.contains(node) &&
        !menuRef.current?.contains(node)
      )
        onOpenChange(false);
    };
    const close = () => onOpenChange(false);
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="meter-overflow-trigger"
        aria-label={t("moreReadingActions")}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <Ellipsis />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="meter-overflow-menu meter-overflow-portal"
            style={position}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

function ClosingAction({
  meterId,
  readingId,
  month,
  onSelect,
}: {
  meterId: string;
  readingId: string;
  month: string;
  onSelect: () => void;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  const [, action] = React.useActionState(
    markReadingAsMonthlyClosingAction,
    emptyActionState,
  );
  return (
    <form action={action} onSubmit={onSelect}>
      <input type="hidden" name="meterId" value={meterId} />
      <input type="hidden" name="readingId" value={readingId} />
      <input type="hidden" name="billingMonth" value={`${month}-01`} />
      <button type="submit">
        <Gauge aria-hidden="true" />
        {t("useAsClosing", { month: formatMonthLocale(`${month}-01`, locale) })}
      </button>
    </form>
  );
}

function ReadingOptions({
  open,
  onOpenChange,
  source,
  reason,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "MEASURED" | "ESTIMATED";
  reason: string;
  onChange: (source: "MEASURED" | "ESTIMATED", reason: string) => void;
}) {
  const t = useTranslations("utilities");
  const [draftSource, setDraftSource] = React.useState(source),
    [draftReason, setDraftReason] = React.useState(reason);
  React.useEffect(() => {
    if (open) {
      setDraftSource(source);
      setDraftReason(reason);
    }
  }, [open, source, reason]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("readingOptions")}</DialogTitle>
<DialogDescription>{t("readingOptionsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="dialog-form">
          <div className="field">
            <Label>{t("source")}</Label>
            <select
              value={draftSource}
              onChange={(event) =>
                setDraftSource(event.target.value as "MEASURED" | "ESTIMATED")
              }
            >
              <option value="MEASURED">{t("measured")}</option>
              <option value="ESTIMATED">{t("estimated")}</option>
            </select>
          </div>
          {draftSource === "ESTIMATED" && (
            <div className="field">
              <Label>{t("estimatedReason")}</Label>
              <Input
                value={draftReason}
                onChange={(event) => setDraftReason(event.target.value)}
                required
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={draftSource === "ESTIMATED" && !draftReason.trim()}
            onClick={() => onChange(draftSource, draftReason)}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhotoAction({
  open,
  onOpenChange,
  meterId,
  readingId,
  photoCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meterId: string;
  readingId: string;
  photoCount: number;
}) {
  const t = useTranslations("utilities");
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [state, action] = React.useActionState(
    appendMeterReadingPhotoAction,
    emptyActionState,
  );
  const currentIndex = Math.min(photoIndex, Math.max(photoCount - 1, 0));
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setPhotoIndex(0);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="media-preview-dialog">
        <DialogHeader>
          <DialogTitle>{t("meterReadingEvidence")}</DialogTitle>
<DialogDescription>{t("evidenceAppendDescription")}</DialogDescription>
        </DialogHeader>
        {photoCount > 0 && (
          <div className="meter-evidence-gallery">
            <div className="meter-evidence-stage">
              <img
                key={currentIndex}
                src={`/api/meters/${meterId}/media/${readingId}?index=${currentIndex}`}
                alt={t("evidenceAlt", { current: currentIndex + 1, count: photoCount })}
              />
            </div>
            {photoCount > 1 && (
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
                <span>{currentIndex + 1} / {photoCount}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t("nextEvidence")}
                  disabled={currentIndex >= photoCount - 1}
                  onClick={() =>
                    setPhotoIndex((value) => Math.min(photoCount - 1, value + 1))
                  }
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        )}
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
          <Button type="submit">{t("addPhoto")}</Button>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function NoMeterRow({ entry }: { entry: Entries[number] }) {
  const t = useTranslations("utilities");
  return (
    <tr className="meter-no-meter-row">
      <td className="meter-col-room">
        <div className="meter-identity">
          <strong>{entry.room}</strong>
          <span>{entry.floorName}</span>
        </div>
      </td>
      <td className="meter-col-no-meter" colSpan={5}>
        <strong>{t("noMeterInstalled")}</strong>
<div className="utility-subtle">{t("configureMeterToStart")}</div>
      </td>
      <td className="meter-col-status">
        <MeterWorkflowStatus entry={entry} />
      </td>
      <td className="meter-col-actions">
        <InstallMeterDialog spaceId={entry.spaceId} room={entry.room} />
      </td>
    </tr>
  );
}

function InstallMeterDialog({
  spaceId,
  room,
}: {
  spaceId: string;
  room: string;
}) {
  const t = useTranslations("utilities");
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await installMeterAction(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> {t("installMeter")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("installElectricityMeter")}</DialogTitle>
<DialogDescription>{t("installMeterDescription", { room })}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="spaceId" value={spaceId} />
          <Field label={t("meterNumber")} name="meterNumber" />
          <Field
            label={t("installedDate")}
            name="installedAt"
            type="date"
            required
          />
          <Field
            label={t("initialReading")}
            name="initialReading"
            type="number"
            step="0.001"
            required
          />
          <div className="field">
            <Label>{t("notes")}</Label>
            <Textarea name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">{t("installMeter")}</Button>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  const id = React.useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const todayDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
function validMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}
