"use client";

import * as React from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/lib/presentation";
import { recordMissingBoundaryAction } from "../actions";

type Boundary = {
  tenancyId: string;
  boundaryType: "MOVE_IN" | "MOVE_OUT";
  boundaryDate: Date;
  tenantName: string;
  meterNumber: string | null;
};

export function BoundaryReadingDialog({
  boundary,
  room,
}: {
  boundary: Boundary;
  room: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(
    "MEASURED",
  );
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await recordMissingBoundaryAction(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );
  const label = boundary.boundaryType === "MOVE_IN" ? "Move-in" : "Move-out";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Gauge /> Record boundary
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record {label.toLowerCase()} boundary</DialogTitle>
          <DialogDescription>
            {room} · {boundary.tenantName}. The tenancy date and physical meter
            are locked.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <input type="hidden" name="tenancyId" value={boundary.tenancyId} />
          <input
            type="hidden"
            name="boundaryType"
            value={boundary.boundaryType}
          />
          <div className="dialog-grid">
            <Info
              label="Boundary date"
              value={formatDate(boundary.boundaryDate)}
            />
            <Info
              label="Physical meter"
              value={boundary.meterNumber || "Unnumbered meter"}
            />
          </div>
          <div className="dialog-grid">
            <Field
              label="Reading"
              name="readingValue"
              type="number"
              step="0.001"
              required
            />
            <div className="field">
              <Label htmlFor="boundary-source">Source</Label>
              <select
                id="boundary-source"
                name="source"
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as "MEASURED" | "ESTIMATED")
                }
              >
                <option value="MEASURED">Measured</option>
                <option value="ESTIMATED">Estimated</option>
              </select>
            </div>
          </div>
          {source === "ESTIMATED" && (
            <Field label="Estimate reason" name="reason" required />
          )}
          <Field
            label="Photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <div className="field">
            <Label htmlFor="boundary-notes">Notes</Label>
            <Textarea id="boundary-notes" name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">Save boundary</Button>
          </DialogFooter>
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
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <strong>{value}</strong>
    </div>
  );
}
