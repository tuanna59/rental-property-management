"use client";

import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/presentation";

const readingLabels = {
  MONTHLY: "Monthly",
  MOVE_IN: "Move-in",
  MOVE_OUT: "Move-out",
  MANUAL: "Manual",
  METER_INSTALL: "Meter installed",
  METER_REMOVAL: "Meter removed",
} as const;

export function MeterHistory({
  history,
}: {
  history: Awaited<
    ReturnType<typeof import("../server/utility.queries").getSpaceMeterHistory>
  >;
}) {
  return (
    <section className="meter-history-list">
      {history.map((meter, index) => (
        <article className="meter-history-group" key={meter.id}>
          <div className="meter-history-heading">
            <div>
              <span>
                {meter.removedAt ? "Previous meter" : "Current meter"}
              </span>
              <h3>{meter.meterNumber || "Unnumbered meter"}</h3>
            </div>
            <span
              className={`utility-status ${meter.removedAt ? "is-incomplete" : "is-complete"}`}
            >
              {meter.removedAt ? "Removed" : "Active"}
            </span>
          </div>
          <p className="utility-subtle">
            Installed {formatDate(meter.installedAt)}
            {meter.removedAt && ` · Removed ${formatDate(meter.removedAt)}`}
          </p>
          <div className="meter-reading-list">
            {meter.readings.map((reading) => (
              <div className="meter-reading-item" key={reading.id}>
                <time>{formatDate(reading.readingDate)}</time>
                <strong>
                  {Number(reading.readingValue).toLocaleString()} kWh
                </strong>
                <span>{readingLabels[reading.readingType]}</span>
                <span
                  className={`utility-status ${reading.source === "ESTIMATED" ? "is-estimated" : "is-complete"}`}
                >
                  {reading.source === "ESTIMATED" ? "Estimated" : "Measured"}
                </span>
                {reading.hasPhoto && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" size="sm" variant="ghost">
                        <ImageIcon /> View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="media-preview-dialog">
                      <DialogHeader>
                        <DialogTitle>Meter reading photo</DialogTitle>
                      </DialogHeader>
                      <img
                        src={`/api/meters/${meter.id}/media/${reading.id}`}
                        alt={`${readingLabels[reading.readingType]} reading on ${formatDate(reading.readingDate)}`}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
