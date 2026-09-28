"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { toDateOnly } from "@/lib/presentation";
import { updateMeterReadingAction } from "../actions";

type Reading = Awaited<ReturnType<typeof import("../server/utility.queries").getSpaceMeterHistory>>[number]["readings"][number];

export function EditMeterReadingDialog({ meterNumber, reading }: { meterNumber: string | null; reading: Reading }) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(reading.source);
  const [state, action] = React.useActionState(async (previous: ActionState, data: FormData) => {
    const result = await updateMeterReadingAction(previous, data);
    if (result.ok) setOpen(false);
    return result;
  }, emptyActionState);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="ghost">Edit</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Edit reading</DialogTitle><DialogDescription>{meterNumber || "Unnumbered meter"} · corrections remain on the same physical meter.</DialogDescription></DialogHeader>
      <form action={action} className="dialog-form">
        <input type="hidden" name="readingId" value={reading.id} />
        <div className="dialog-grid"><Field label="Reading" name="readingValue" type="number" step="0.001" defaultValue={reading.readingValue} required /><Field label="Reading date" name="readingDate" type="date" defaultValue={toDateOnly(reading.readingDate)} required /></div>
        <div className="field"><Label>Source</Label><select name="source" value={source} onChange={(event) => setSource(event.target.value as "MEASURED" | "ESTIMATED")}><option value="MEASURED">Measured</option><option value="ESTIMATED">Estimated</option></select></div>
        {source === "ESTIMATED" && <Field label="Estimated reason" name="reason" defaultValue={reading.reason ?? ""} required />}
        <Field label="Add evidence photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        {state.message && <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
        <DialogFooter><Button type="submit">Save changes</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string }) { const id = React.useId(); return <div className="field"><Label htmlFor={id}>{label}</Label><Input id={id} {...props} /></div>; }
