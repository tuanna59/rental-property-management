"use client";

import * as React from "react";
import { Camera, CheckCircle2, Gauge, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";

import { installMeterAction, saveMonthlyReadingAction } from "../actions";
import type { getMonthlyMeterEntries } from "../server/utility.queries";
import { MeterDetails } from "./meter-details";
import {
  EmptyUtilitiesState,
  MonthSelector,
  UtilityStatusBadge,
} from "./utility-ui";

type Entries = Awaited<ReturnType<typeof getMonthlyMeterEntries>>;

export function MonthlyMeterEntry({
  entries,
  month,
}: {
  entries: Entries;
  month: string;
}) {
  const recorded = entries.filter(
    (entry) =>
      entry.readingStatus === "RECORDED" || entry.readingStatus === "ESTIMATED",
  ).length;
  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">MONTHLY WORKFLOW</p>
          <h1>Meter readings</h1>
          <p>Enter monthly electricity readings for all rental rooms.</p>
        </div>
        <MonthSelector month={month} />
      </header>
      <section className="utility-section meter-grid-section">
        <div className="utility-section-header">
          <div>
            <h2>Monthly entry</h2>
            <p>
              Each room saves independently. Existing monthly readings are
              updated in place.
            </p>
          </div>
          <span className="utility-status is-complete">
            <CheckCircle2 /> {recorded} recorded
          </span>
        </div>
        {entries.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table meter-grid">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Meter</th>
                  <th>Previous closing</th>
                  <th>Monthly closing</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Known usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) =>
                  entry.activeMeter ? (
                    <ActiveMeterRow
                      key={entry.spaceId}
                      entry={entry}
                      month={month}
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
            title="No rental rooms"
            description="Add a rental room before configuring utility meters."
          />
        )}
      </section>
      {entries.length > 0 && (
        <p className="meter-grid-note">
          <Gauge /> Usage compares readings on the same physical meter only.
        </p>
      )}
    </div>
  );
}

function ActiveMeterRow({
  entry,
  month,
}: {
  entry: Entries[number];
  month: string;
}) {
  const formId = React.useId();
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(
    entry.source,
  );
  const [state, action] = React.useActionState(
    saveMonthlyReadingAction,
    emptyActionState,
  );
  const status =
    entry.readingStatus === "ESTIMATED"
      ? "estimated"
      : entry.readingStatus === "MISSING"
        ? "missing"
        : "complete";
  return (
    <tr>
      <td>
        <div className="utility-room">{entry.room}</div>
      </td>
      <td>
        <strong>{entry.meterNumber || "Unnumbered"}</strong>
        <div className="utility-subtle">
          Installed{" "}
          {entry.activeMeter
            ? new Intl.DateTimeFormat("en", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }).format(entry.activeMeter.installedAt)
            : "—"}
        </div>
      </td>
      <td>
        <strong>
          {entry.previousReading
            ? Number(entry.previousReading.readingValue).toLocaleString()
            : "—"}
        </strong>
        {entry.previousReading && (
          <div className="utility-subtle">
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }).format(entry.previousReading.readingDate)}
          </div>
        )}
      </td>
      <td>
        <form id={formId} action={action} className="meter-current-form">
          <input type="hidden" name="meterId" value={entry.activeMeter!.id} />
          <input type="hidden" name="billingMonth" value={`${month}-01`} />
          <input
            type="hidden"
            name="monthlyReadingId"
            value={entry.monthlyReading?.id ?? ""}
          />
          <Input
            name="readingValue"
            type="number"
            step="0.001"
            defaultValue={entry.current ?? ""}
            placeholder="Reading"
            required
          />
          {source === "ESTIMATED" && (
            <Input
              name="reason"
              defaultValue={entry.monthlyReading?.reason ?? ""}
              placeholder="Estimate reason"
              required
            />
          )}
          {state.message && (
            <span className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </span>
          )}
        </form>
      </td>
      <td>
        <Input
          form={formId}
          name="readingDate"
          type="date"
          defaultValue={
            entry.readingDate
              ? entry.readingDate.toISOString().slice(0, 10)
              : monthEndDate(month)
          }
          required
        />
      </td>
      <td>
        <select
          form={formId}
          name="source"
          value={source}
          onChange={(event) =>
            setSource(event.target.value as "MEASURED" | "ESTIMATED")
          }
        >
          <option value="MEASURED">Measured</option>
          <option value="ESTIMATED">Estimated</option>
        </select>
      </td>
      <td>
        <strong>
          {entry.knownPhysicalUsage !== null
            ? `${Number(entry.knownPhysicalUsage).toLocaleString()} kWh`
            : "—"}
        </strong>
        {entry.knownPhysicalUsage !== null && (
          <div className="utility-subtle">
            {entry.isClosingComplete ? "Complete" : "Known so far"}
          </div>
        )}
      </td>
      <td>
        <UtilityStatusBadge status={status} />
        {entry.lateReadingDays ? (
          <div className="utility-subtle">
            Late +{entry.lateReadingDays} days
          </div>
        ) : null}
      </td>
      <td>
        <div className="meter-row-actions">
          <label
            className="compact-photo-button"
            title={
              entry.monthlyReading?.hasPhoto ? "Replace photo" : "Attach photo"
            }
          >
            <Camera />
            <span>
              {entry.monthlyReading?.hasPhoto ? "Photo" : "Add photo"}
            </span>
            <input
              form={formId}
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          <Button form={formId} type="submit" size="sm">
            {entry.monthlyReading ? "Update" : "Save"}
          </Button>
          <MeterDetails entry={entry} />
        </div>
      </td>
    </tr>
  );
}

function NoMeterRow({ entry }: { entry: Entries[number] }) {
  return (
    <tr>
      <td>
        <div className="utility-room">{entry.room}</div>
      </td>
      <td colSpan={7}>
        <strong>No meter installed</strong>
        <div className="utility-subtle">
          Configure an electricity meter to start monthly tracking.
        </div>
      </td>
      <td>
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
    async (previous: ActionState, formData: FormData) => {
      const result = await installMeterAction(previous, formData);
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
            Configure the first meter for {room}. Its initial reading can be
            non-zero.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <input type="hidden" name="spaceId" value={spaceId} />
          <div className="dialog-grid">
            <Field
              label="Meter number"
              name="meterNumber"
              placeholder="Optional"
            />
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
            <Field
              label="Meter photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </div>
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
        </form>
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

function monthEndDate(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}
