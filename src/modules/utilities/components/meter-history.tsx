"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/presentation";
import { Input } from "@/components/ui/input";
import { emptyActionState } from "@/lib/action-state";
import { appendMeterReadingPhotoAction } from "../actions";
import { EditMeterReadingDialog } from "./edit-meter-reading-dialog";

const labels = {
  MONTHLY: "Legacy monthly reading",
  MOVE_IN: "Move-in",
  MOVE_OUT: "Move-out",
  MANUAL: "Manual reading",
  METER_INSTALL: "Meter installed",
  METER_REMOVAL: "Meter removed",
} as const;

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
  if (!history.length) {
    return <p className="meter-details-empty">No meter readings yet.</p>;
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
                Meter replaced · {formatDate(replacementDate)}
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
  const heading = (
    <div className="meter-history-heading">
      <div>
        <h3>{meter.meterNumber || "Unnumbered meter"}</h3>
        <p className="utility-subtle">
          {retired
            ? `${formatDate(meter.installedAt)} → ${formatDate(meter.removedAt!)}`
            : `Installed ${formatDate(meter.installedAt)}`}
        </p>
      </div>
      <span
        className={`utility-status ${retired ? "is-estimated" : "is-complete"}`}
      >
        {retired ? "Retired" : "Active"}
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
              <th>Date</th>
              <th>Reading</th>
              <th>Type</th>
              <th>Role</th>
              <th>Evidence</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {meter.readings.map((reading) => (
              <tr key={reading.id}>
                <td>{formatDate(reading.readingDate)}</td>
                <td>
                  <strong>
                    {Number(reading.readingValue).toLocaleString()} kWh
                  </strong>
                </td>
                <td>{labels[reading.readingType]}</td>
                <td>
                  <div className="meter-reading-role">
                    <span>{readingRole(reading)}</span>
                    {reading.isLocked && (
                      <span className="utility-status is-incomplete">Locked</span>
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
                      View
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

function readingRole(reading: Reading) {
  if (reading.isClosing && reading.billingMonth) {
    return `${monthName(reading.billingMonth)} closing`;
  }
  if (reading.readingType === "MOVE_IN" || reading.readingType === "MOVE_OUT") {
    return "Tenant boundary";
  }
  if (
    reading.readingType === "METER_INSTALL" ||
    reading.readingType === "METER_REMOVAL"
  ) {
    return "Meter lifecycle event";
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
            ? `${count} photo${count === 1 ? "" : "s"}`
            : readOnly
              ? "No photo"
              : "Add photo"}
        </Button>
      </DialogTrigger>
      <DialogContent className="media-preview-dialog">
        <DialogHeader>
          <DialogTitle>Meter reading evidence</DialogTitle>
        </DialogHeader>
        {count > 0 && (
          <div className="meter-evidence-gallery">
            <div className="meter-evidence-stage">
              <img
                key={currentIndex}
                src={`/api/meters/${meterId}/media/${readingId}?index=${currentIndex}`}
                alt={`Meter reading evidence ${currentIndex + 1} of ${count}`}
              />
            </div>
            {count > 1 && (
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
                <span>{currentIndex + 1} / {count}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Next evidence photo"
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
            <Button type="submit">Add evidence photo</Button>
          </PreservingActionForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

function monthName(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}
