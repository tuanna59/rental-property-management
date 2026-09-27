"use client";

import * as React from "react";
import { Repeat2 } from "lucide-react";

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

import { replaceMeterAction } from "../actions";

export function ReplaceMeterDialog({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(
    "MEASURED",
  );
  const [state, action] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await replaceMeterAction(previous, formData);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Repeat2 /> Replace meter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace electricity meter</DialogTitle>
          <DialogDescription>
            Close the old physical meter and install its replacement in one
            operation.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <input type="hidden" name="spaceId" value={spaceId} />
          <Field
            label="Replacement date"
            name="replacementDate"
            type="date"
            required
          />
          <div className="dialog-section">
            <h3>Old meter</h3>
            <div className="dialog-grid">
              <Field
                label="Final reading"
                name="oldMeterFinalReading"
                type="number"
                step="0.001"
                placeholder="Optional"
              />
              <div className="field">
                <Label>Source</Label>
                <select
                  name="oldMeterFinalReadingSource"
                  value={source}
                  onChange={(event) =>
                    setSource(event.target.value as "MEASURED" | "ESTIMATED")
                  }
                >
                  <option value="MEASURED">Measured</option>
                  <option value="ESTIMATED">Estimated</option>
                </select>
              </div>
              <Field
                label="Photo"
                name="oldMeterPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
          </div>
          {source === "ESTIMATED" && (
            <p className="text-xs text-[#8a5b1e]">
              The replacement reason below also explains the estimated final
              reading.
            </p>
          )}
          <div className="dialog-section">
            <h3>New meter</h3>
            <div className="dialog-grid">
              <Field
                label="Meter number"
                name="newMeterNumber"
                placeholder="Optional"
              />
              <Field
                label="Initial reading"
                name="newMeterInitialReading"
                type="number"
                step="0.001"
                required
              />
              <Field
                label="Photo"
                name="newMeterPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
          </div>
          <Field label="Reason" name="reason" required />
          <div className="field">
            <Label>Notes</Label>
            <Textarea name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <Repeat2 /> Replace meter
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
