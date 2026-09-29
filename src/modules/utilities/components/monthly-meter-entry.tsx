"use client";

import * as React from "react";
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
          <p className="utilities-eyebrow">METER READINGS</p>
          <h1>Meter readings</h1>
          <p>
            Record physical readings and assign eligible manual readings as
            monthly closings.
          </p>
        </div>
        <MonthSelector month={selectedMonth} />
      </header>
      <section className="utility-section meter-fast-section">
        <div className="utility-section-header meter-fast-toolbar">
          <div className="meter-toolbar-primary">
            <div
              className="meter-filter-group"
              aria-label="Billing month editability filter"
            >
              {(
                [
                  ["ALL", "All", entries.length],
                  ["OPEN", "Open", openRows.length],
                  ["CLOSED", "Closed", closedRows.length],
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
                  <th>Room / meter</th>
                  <th>Previous closing</th>
                  <th>Latest reading</th>
                  <th>New reading</th>
                  <th>Reading date</th>
                  <th>Known usage</th>
                  <th>Status</th>
                  <th>Actions</th>
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
            title="No rooms in this view"
            description="Choose another filter or billing month."
          />
        )}
      </section>
      <p className="meter-grid-note">
        <Gauge /> Monthly closing assignment, latest reading, and known physical
        usage are tracked separately. Usage is never subtracted across meter IDs.
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
              {entry.floorName} · {entry.meterNumber || "Unnumbered"}
            </span>
            {entry.meterReplacementDuringMonth && (
              <span
                className="meter-replacement-indicator"
                tabIndex={0}
                aria-label="Meter replaced this month"
                data-tooltip="Meter replaced this month"
              >
                <Info aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="meter-col-previous">
        <span className="meter-mobile-label">Previous closing</span>
        {entry.previousClosingReading ? (
          <>
            <strong>
              {number(entry.previousClosingReading.readingValue)} kWh
            </strong>
            <div className="utility-subtle">
              {shortDate(entry.previousClosingReading.readingDate)}
            </div>
          </>
        ) : (
          <>
            <strong>—</strong>
            {entry.activeMeterIsNewThisMonth && (
              <div className="utility-subtle">New meter</div>
            )}
          </>
        )}
      </td>
      <td className="meter-col-latest">
        <span className="meter-mobile-label">Latest reading</span>
        <LatestReading entry={entry} />
      </td>
      <td className="meter-col-new-reading">
        <span className="meter-mobile-label">New reading</span>
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
        <span className="meter-mobile-label">Reading date</span>
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
        <span className="meter-mobile-label">Known usage</span>
        <strong>
          {entry.knownPhysicalUsage !== null
            ? `${number(entry.knownPhysicalUsage)} kWh`
            : "—"}
        </strong>
        {entry.knownUsageMeterCount > 1 && (
          <div className="utility-subtle">{entry.knownUsageMeterCount} meters</div>
        )}
        {!locked && source === "ESTIMATED" && (
          <div className="utility-status is-estimated">Estimated input</div>
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
                  View details
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
                  Reading options
                </button>
                {candidate ? (
                  <button type="button" onClick={() => openOverlay("PHOTO")}>
                    <ImageIcon aria-hidden="true" />
                    {candidate.hasPhoto ? "Add / view photo" : "Add photo"}
                  </button>
                ) : (
                  <span className="disabled-menu-item">Add photo after saving</span>
                )}
                <button type="button" onClick={() => openOverlay("HISTORY")}>
                  <History aria-hidden="true" />
                  View reading history
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
  const latest = entry.latestReading;
  if (!latest) return <span className="utility-subtle">No reading</span>;

  return (
    <div className="meter-reading-plain">
      <strong>{number(latest.readingValue)} kWh</strong>
      <span>{shortDate(latest.readingDate)}</span>
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
  if (!entry.activeMeter) {
    return (
      <div className="meter-workflow-status">
        <span className="utility-status is-estimated">No meter</span>
      </div>
    );
  }

  const closingMonth = month ? shortMonthLabel(month) : null;
  const qualityText =
    entry.closingDateQuality === "EARLY"
      ? "Early"
      : entry.closingDateQuality === "LATE" ||
          entry.closingDateQuality === "VERY_LATE"
        ? `Late ${entry.closingDateOffsetDays}d`
        : null;

  if (entry.closingLocked || entry.closingStatus === "LOCKED") {
    const detail = entry.monthlyReading && closingMonth
      ? [ `${closingMonth} closing`, "Locked", qualityText ].filter(Boolean).join(" · ")
      : "Billing period locked";
    return (
      <div className="meter-workflow-status">
        <span className="utility-status is-complete">Closed</span>
        <span>{detail}</span>
      </div>
    );
  }

  if (!entry.closingRequired || entry.closingStatus === "OPTIONAL") {
    return (
      <div className="meter-workflow-status">
        <span className="utility-status is-estimated">Optional</span>
        <span>Closing not required</span>
      </div>
    );
  }

  const detail = entry.monthlyReading && closingMonth
    ? [ `${closingMonth} closing`, qualityText ].filter(Boolean).join(" · ")
    : "Closing required";

  return (
    <div className="meter-workflow-status">
      <span className="utility-status is-missing">Open</span>
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
          Set {rows.length} current reading{rows.length === 1 ? "" : "s"} as closing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Set {rows.length} reading{rows.length === 1 ? "" : "s"} as {longMonthLabel(month)} closings?
          </DialogTitle>
          <DialogDescription>
            Only eligible unlocked readings are included. Existing unlocked
            closings will be replaced by the reading shown here.
          </DialogDescription>
        </DialogHeader>
        <div className="bulk-closing-list">
          {rows.map((row) => (
            <div key={`${row.meterId}-${row.readingId}`}>
              <strong>{row.room}</strong>
              <span>
                {number(row.readingValue)} kWh · {shortDate(row.readingDate)}
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
        aria-label="More reading actions"
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
        Use as {monthLabel(`${month}-01`)} closing
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
          <DialogTitle>Reading options</DialogTitle>
          <DialogDescription>
            Measured is the default for quick entry.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-form">
          <div className="field">
            <Label>Source</Label>
            <select
              value={draftSource}
              onChange={(event) =>
                setDraftSource(event.target.value as "MEASURED" | "ESTIMATED")
              }
            >
              <option value="MEASURED">Measured</option>
              <option value="ESTIMATED">Estimated</option>
            </select>
          </div>
          {draftSource === "ESTIMATED" && (
            <div className="field">
              <Label>Estimated reason</Label>
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
          <DialogTitle>Meter reading evidence</DialogTitle>
          <DialogDescription>
            New evidence is appended and existing evidence is preserved.
          </DialogDescription>
        </DialogHeader>
        {photoCount > 0 && (
          <div className="meter-evidence-gallery">
            <div className="meter-evidence-stage">
              <img
                key={currentIndex}
                src={`/api/meters/${meterId}/media/${readingId}?index=${currentIndex}`}
                alt={`Meter reading evidence ${currentIndex + 1} of ${photoCount}`}
              />
            </div>
            {photoCount > 1 && (
              <div className="meter-evidence-nav" aria-label="Evidence photo navigation">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Previous evidence photo"
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
                  aria-label="Next evidence photo"
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
          <Input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">Add photo</Button>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function NoMeterRow({ entry }: { entry: Entries[number] }) {
  return (
    <tr className="meter-no-meter-row">
      <td className="meter-col-room">
        <div className="meter-identity">
          <strong>{entry.room}</strong>
          <span>{entry.floorName}</span>
        </div>
      </td>
      <td className="meter-col-no-meter" colSpan={5}>
        <strong>No meter installed</strong>
        <div className="utility-subtle">
          Configure a meter to start recording.
        </div>
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
          <Plus /> Install meter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install electricity meter</DialogTitle>
          <DialogDescription>
            Configure the first meter for {room}.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="spaceId" value={spaceId} />
          <Field label="Meter number" name="meterNumber" />
          <Field
            label="Installed date"
            name="installedAt"
            type="date"
            required
          />
          <Field
            label="Initial reading"
            name="initialReading"
            type="number"
            step="0.001"
            required
          />
          <div className="field">
            <Label>Notes</Label>
            <Textarea name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <Button type="submit">Install meter</Button>
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
const number = (value: string) => Number(value).toLocaleString();

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
function shortMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
function longMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
const todayDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
const shortDate = (value: Date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
function monthLabel(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
function validMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}
