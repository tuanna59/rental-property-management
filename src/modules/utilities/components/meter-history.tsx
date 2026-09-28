"use client";

import * as React from "react";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "@/lib/presentation";
import { Input } from "@/components/ui/input";
import { emptyActionState } from "@/lib/action-state";
import { appendMeterReadingPhotoAction } from "../actions";
import { EditMeterReadingDialog } from "./edit-meter-reading-dialog";

const labels = { MONTHLY: "Monthly", MOVE_IN: "Move-in", MOVE_OUT: "Move-out", MANUAL: "Manual", METER_INSTALL: "Meter installed", METER_REMOVAL: "Meter removed" } as const;
type History = Awaited<ReturnType<typeof import("../server/utility.queries").getSpaceMeterHistory>>;

export function MeterHistory({ history }: { history: History }) {
  return <section className="meter-history-list">{history.map((meter) => <article className="meter-history-group" key={meter.id}>
    <div className="meter-history-heading"><div><span>{meter.removedAt ? "Previous meter" : "Current meter"}</span><h3>{meter.meterNumber || "Unnumbered meter"}</h3></div><span className={`utility-status ${meter.removedAt ? "is-incomplete" : "is-complete"}`}>{meter.removedAt ? "Removed" : "Active"}</span></div>
    <p className="utility-subtle">Installed {formatDate(meter.installedAt)}{meter.removedAt && ` · Removed ${formatDate(meter.removedAt)}`}</p>
    <div className="utility-table-wrap"><table className="utility-table meter-history-table"><thead><tr><th>Date</th><th>Reading</th><th>Type</th><th>Source</th><th>Evidence</th><th>Billing</th><th>Action</th></tr></thead><tbody>
      {meter.readings.map((reading) => <tr key={reading.id}>
        <td>{formatDate(reading.readingDate)}</td><td><strong>{Number(reading.readingValue).toLocaleString()} kWh</strong></td>
        <td>{labels[reading.readingType]}{reading.isClosing && reading.billingMonth ? ` · Closing ${monthName(reading.billingMonth)}` : ""}</td>
        <td>{reading.source === "ESTIMATED" ? "Estimated" : "Measured"}</td>
        <td><PhotoDialog meterId={meter.id} readingId={reading.id} count={reading.photoCount} /></td>
        <td>{reading.isManaged ? <><span className="utility-status is-incomplete">Managed</span><small>{reading.readingType === "MOVE_IN" || reading.readingType === "MOVE_OUT" ? "Tenancy event" : "Meter lifecycle event"}</small></> : reading.isLocked && reading.lockInvoice ? <><span className="utility-status is-incomplete">Locked</span><small>Used in {reading.lockInvoice.type === "FINAL_SETTLEMENT" ? "Final Settlement" : "finalized invoice"} · <Link href={`/billing/invoices/${reading.lockInvoice.id}`}>{reading.lockInvoice.roomNameSnapshot} {monthName(reading.lockInvoice.billingPeriod)}</Link></small></> : <span className="utility-status is-complete">Open</span>}</td>
        <td>{!reading.isManaged && !reading.isLocked ? <EditMeterReadingDialog meterNumber={meter.meterNumber} reading={reading} /> : <Button type="button" size="sm" variant="ghost" disabled>View</Button>}</td>
      </tr>)}
    </tbody></table></div>
  </article>)}</section>;
}

function PhotoDialog({ meterId, readingId, count }: { meterId: string; readingId: string; count: number }) {
  const [state, action] = React.useActionState(appendMeterReadingPhotoAction, emptyActionState);
  return <Dialog><DialogTrigger asChild><Button type="button" size="sm" variant="ghost"><ImageIcon /> {count ? `${count} photo${count === 1 ? "" : "s"}` : "Add photo"}</Button></DialogTrigger><DialogContent className="media-preview-dialog"><DialogHeader><DialogTitle>Meter reading evidence</DialogTitle></DialogHeader>{count > 0 && <img src={`/api/meters/${meterId}/media/${readingId}`} alt="Meter reading evidence" />}<form action={action} className="dialog-form"><input type="hidden" name="readingId" value={readingId} /><Input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />{state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}<Button type="submit">Add evidence photo</Button></form></DialogContent></Dialog>;
}

function monthName(value: Date) { return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(value); }
