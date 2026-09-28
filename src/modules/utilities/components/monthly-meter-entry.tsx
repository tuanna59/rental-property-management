"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Ellipsis, Gauge, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { appendMeterReadingPhotoAction, installMeterAction, markAllCurrentReadingsClosedAction, markCurrentReadingClosedAction, recordReadingAction } from "../actions";
import type { getMonthlyMeterEntries } from "../server/utility.queries";
import { MeterDetails } from "./meter-details";
import { EmptyUtilitiesState } from "./utility-ui";

type Entries = Awaited<ReturnType<typeof getMonthlyMeterEntries>>;
type Filter = "OPEN" | "CLOSED" | "ALL";

export function MonthlyMeterEntry({ entries, month, propertyId }: { entries: Entries; month: string; propertyId: string }) {
  const [filter, setFilter] = React.useState<Filter>("OPEN");
  const openEntries = entries.filter((entry) => !entry.monthlyReading);
  const closedEntries = entries.filter((entry) => entry.monthlyReading);
  const visible = filter === "OPEN" ? openEntries : filter === "CLOSED" ? closedEntries : entries;
  const canClose = openEntries.filter((entry) => entry.currentReading).length;
  const [, bulkAction, bulkPending] = React.useActionState(markAllCurrentReadingsClosedAction, emptyActionState);

  return <div className="utilities-content">
    <header className="utilities-header meter-fast-header">
      <div className="utilities-header-copy"><p className="utilities-eyebrow">METER READINGS</p><h1>Meter readings</h1><p>Record current manual readings, then close the month when ready.</p></div>
      <MonthNavigation month={month} />
    </header>
    <section className="utility-section meter-fast-section">
      <div className="utility-section-header meter-fast-toolbar">
        <div className="meter-filter-group" aria-label="Reading status filter">
          {([["OPEN", "Open", openEntries.length], ["CLOSED", "Closed", closedEntries.length], ["ALL", "All", entries.length]] as const).map(([value, label, count]) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{label} <span>{count}</span></button>)}
        </div>
        <form action={bulkAction}>
          <input type="hidden" name="propertyId" value={propertyId} /><input type="hidden" name="billingMonth" value={`${month}-01`} />
          <Button type="submit" variant="outline" disabled={!canClose || bulkPending}>{canClose ? `Mark ${canClose} current readings as closed` : "No readings can close"}</Button>
        </form>
      </div>
      {visible.length ? <div className="utility-table-wrap"><table className="utility-table meter-fast-grid"><thead><tr><th>Room / meter</th><th>Last reading</th><th>Current reading</th><th>Reading date</th><th>Known usage</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.map((entry) => entry.activeMeter ? <MeterEntryRow key={entry.spaceId} entry={entry} month={month} /> : <NoMeterRow key={entry.spaceId} entry={entry} />)}
      </tbody></table></div> : <EmptyUtilitiesState title={filter === "OPEN" ? "No open rooms" : "No readings in this view"} description={filter === "OPEN" ? "All applicable rooms are closed for this billing month." : "Choose another status or billing month."} />}
    </section>
    <p className="meter-grid-note"><Gauge /> Usage compares readings on the same physical meter only.</p>
  </div>;
}

function MeterEntryRow({ entry, month }: { entry: Entries[number]; month: string }) {
  const meter = entry.activeMeter;
  if (!meter) return null;
  const formId = React.useId();
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(entry.currentReading?.source ?? "MEASURED");
  const [reason, setReason] = React.useState(entry.currentReading?.reason ?? "");
  const [state, saveAction, pending] = React.useActionState(recordReadingAction, emptyActionState);
  const current = entry.currentReading;
  return <tr>
    <td><div className="meter-identity"><strong>{entry.room}</strong><span>{entry.floorName} · {entry.meterNumber || "Unnumbered"}</span>{meter.installedAt >= entry.billingMonth && <small>Replaced {shortDate(meter.installedAt)}</small>}</div></td>
    <td><strong>{entry.previousReading ? `${number(entry.previousReading.readingValue)} kWh` : "—"}</strong>{entry.previousReading && <div className="utility-subtle">{shortDate(entry.previousReading.readingDate)}</div>}</td>
    <td><form id={formId} action={saveAction} className="meter-inline-form"><input type="hidden" name="meterId" value={meter.id} /><input type="hidden" name="source" value={source} /><input type="hidden" name="reason" value={reason} /><Input name="readingValue" type="number" step="0.001" placeholder="Reading" required />{state.message && <small className={state.ok ? "form-success" : "form-error"}>{state.message}</small>}</form></td>
    <td><Input form={formId} name="readingDate" type="date" defaultValue={todayDate()} required /></td>
    <td><strong>{entry.knownPhysicalUsage !== null ? `+${number(entry.knownPhysicalUsage)} kWh` : "—"}</strong>{source === "ESTIMATED" && <div className="utility-status is-estimated">Estimated</div>}</td>
    <td><span className={`utility-status ${entry.monthlyReading ? "is-complete" : "is-incomplete"}`}>{entry.monthlyReading ? "Closed" : "Open"}</span></td>
    <td><div className="meter-row-actions meter-primary-actions"><Button form={formId} type="submit" size="sm" disabled={pending}>Save</Button><details className="meter-overflow"><summary aria-label="More reading actions"><Ellipsis /></summary><div className="meter-overflow-menu">
      {!entry.monthlyReading && current && <ClosingAction meterId={meter.id} readingId={current.id} month={month} />}
      <ReadingOptions source={source} reason={reason} onChange={(nextSource, nextReason) => { setSource(nextSource); setReason(nextReason); }} />
      {current ? <PhotoAction meterId={meter.id} readingId={current.id} hasPhoto={current.hasPhoto} /> : <span className="disabled-menu-item">Add photo after saving</span>}
      <MeterDetails entry={entry} triggerLabel="View reading history" initialTab="history" /><MeterDetails entry={entry} triggerLabel="Manage meter" />
    </div></details></div></td>
  </tr>;
}

function ClosingAction({ meterId, readingId, month }: { meterId: string; readingId: string; month: string }) {
  const [, action] = React.useActionState(markCurrentReadingClosedAction, emptyActionState);
  return <form action={action}><input type="hidden" name="meterId" value={meterId} /><input type="hidden" name="readingId" value={readingId} /><input type="hidden" name="billingMonth" value={`${month}-01`} /><button type="submit">Mark current as closed</button></form>;
}

function ReadingOptions({ source, reason, onChange }: { source: "MEASURED" | "ESTIMATED"; reason: string; onChange: (source: "MEASURED" | "ESTIMATED", reason: string) => void }) {
  const [open, setOpen] = React.useState(false), [draftSource, setDraftSource] = React.useState(source), [draftReason, setDraftReason] = React.useState(reason);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button">Reading options</button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Reading options</DialogTitle><DialogDescription>Measured is the default for quick entry.</DialogDescription></DialogHeader><div className="dialog-form"><div className="field"><Label>Source</Label><select value={draftSource} onChange={(event) => setDraftSource(event.target.value as "MEASURED" | "ESTIMATED")}><option value="MEASURED">Measured</option><option value="ESTIMATED">Estimated</option></select></div>{draftSource === "ESTIMATED" && <div className="field"><Label>Estimated reason</Label><Input value={draftReason} onChange={(event) => setDraftReason(event.target.value)} required /></div>}</div><DialogFooter><Button type="button" disabled={draftSource === "ESTIMATED" && !draftReason.trim()} onClick={() => { onChange(draftSource, draftReason); setOpen(false); }}>Apply</Button></DialogFooter></DialogContent></Dialog>;
}

function PhotoAction({ meterId, readingId, hasPhoto }: { meterId: string; readingId: string; hasPhoto: boolean }) {
  const [state, action] = React.useActionState(appendMeterReadingPhotoAction, emptyActionState);
  return <Dialog><DialogTrigger asChild><button type="button">{hasPhoto ? "Add / view photo" : "Add photo"}</button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Reading evidence</DialogTitle><DialogDescription>New evidence is appended and existing evidence is preserved.</DialogDescription></DialogHeader><form action={action} className="dialog-form"><input type="hidden" name="readingId" value={readingId} />{hasPhoto && <a href={`/api/meters/${meterId}/media/${readingId}`} target="_blank">View existing photo</a>}<Input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />{state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}<Button type="submit">Add photo</Button></form></DialogContent></Dialog>;
}

function MonthNavigation({ month }: { month: string }) {
  return <div className="meter-month-nav"><Link href={`/utilities/meters?month=${shiftMonth(month, -1)}`} aria-label="Previous month"><ChevronLeft /></Link><form action="/utilities/meters"><Input name="month" type="month" defaultValue={month} onChange={(event) => event.currentTarget.form?.requestSubmit()} /></form><Link href={`/utilities/meters?month=${shiftMonth(month, 1)}`} aria-label="Next month"><ChevronRight /></Link><Link className="current-month-link" href={`/utilities/meters?month=${new Date().toISOString().slice(0, 7)}`}>Current</Link></div>;
}

function NoMeterRow({ entry }: { entry: Entries[number] }) { return <tr><td><div className="meter-identity"><strong>{entry.room}</strong><span>{entry.floorName}</span></div></td><td colSpan={5}><strong>No meter installed</strong><div className="utility-subtle">Configure a meter to start recording.</div></td><td><InstallMeterDialog spaceId={entry.spaceId} room={entry.room} /></td></tr>; }

function InstallMeterDialog({ spaceId, room }: { spaceId: string; room: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(async (previous: ActionState, data: FormData) => { const result = await installMeterAction(previous, data); if (result.ok) setOpen(false); return result; }, emptyActionState);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm"><Plus /> Install meter</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Install electricity meter</DialogTitle><DialogDescription>Configure the first meter for {room}.</DialogDescription></DialogHeader><form action={action} className="dialog-form"><input type="hidden" name="spaceId" value={spaceId} /><Field label="Meter number" name="meterNumber" /><Field label="Installed date" name="installedAt" type="date" required /><Field label="Initial reading" name="initialReading" type="number" step="0.001" required /><div className="field"><Label>Notes</Label><Textarea name="notes" /></div>{state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}<Button type="submit">Install meter</Button></form></DialogContent></Dialog>;
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string }) { const id = React.useId(); return <div className="field"><Label htmlFor={id}>{label}</Label><Input id={id} {...props} /></div>; }
const number = (value: string) => Number(value).toLocaleString();
const todayDate = () => new Date().toISOString().slice(0, 10);
const shortDate = (value: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(value);
function shiftMonth(month: string, amount: number) { const [year, value] = month.split("-").map(Number); return new Date(Date.UTC(year, value - 1 + amount, 1)).toISOString().slice(0, 7); }
