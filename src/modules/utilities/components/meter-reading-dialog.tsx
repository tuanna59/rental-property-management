"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { emptyActionState, type ActionState } from "@/lib/action-state";

import { recordReadingAction } from "../actions";

export function MeterReadingDialog({ meterId }: { meterId: string }) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(
    "MEASURED",
  );
  const [state, action] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await recordReadingAction(previous, formData);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus /> Record reading
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record meter reading</DialogTitle>
          <DialogDescription>
            Add a manual observation to this physical meter.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <input type="hidden" name="meterId" value={meterId} />
          <div className="dialog-grid">
            <Field
              label="Reading date"
              name="readingDate"
              type="date"
              defaultValue={todayDate()}
              max={todayDate()}
              required
            />
            <Field
              label="Reading value"
              name="readingValue"
              type="number"
              step="0.001"
              required
            />
          </div>
          <input type="hidden" name="readingType" value="MANUAL" />
          <div className="dialog-grid">
            <div className="field">
              <Label htmlFor="reading-source">Source</Label>
              <select
                id="reading-source"
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
            <Field
              label="Estimate reason"
              name="reason"
              placeholder="Required"
              required
            />
          )}
          <div className="dialog-grid">
            <Field
              label="Meter photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
            <Field label="Notes" name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <Plus /> Record reading
            </Button>
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

const todayDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
