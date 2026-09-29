"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PrivateAttachmentPicker } from "@/components/ui/private-attachment";
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
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { toDateOnly } from "@/lib/presentation";
import { updateMeterReadingAction } from "../actions";

type Reading = Awaited<
  ReturnType<typeof import("../server/utility.queries").getSpaceMeterHistory>
>[number]["readings"][number];

export function EditMeterReadingDialog({
  meterNumber,
  reading,
}: {
  meterNumber: string | null;
  reading: Reading;
}) {
  const t = useTranslations("utilities");
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<"MEASURED" | "ESTIMATED">(
    reading.source,
  );
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await updateMeterReadingAction(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          {t("editReading")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editReading")}</DialogTitle>
          <DialogDescription>
            {meterNumber || t("unnumberedMeter")} · corrections remain on the same
            physical meter.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="readingId" value={reading.id} />
          <div className="dialog-grid">
            <Field
              label={t("reading")}
              name="readingValue"
              type="number"
              step="0.001"
              defaultValue={reading.readingValue}
              required
            />
            <Field
              label={t("readingDate")}
              name="readingDate"
              type="date"
              defaultValue={toDateOnly(reading.readingDate)}
              max={todayDate()}
              required
            />
          </div>
          <div className="field">
            <Label>{t("source")}</Label>
            <select
              name="source"
              value={source}
              onChange={(event) =>
                setSource(event.target.value as "MEASURED" | "ESTIMATED")
              }
            >
              <option value="MEASURED">{t("measured")}</option>
              <option value="ESTIMATED">{t("estimated")}</option>
            </select>
          </div>
          {source === "ESTIMATED" && (
            <Field
              label={t("estimatedReason")}
              name="reason"
              defaultValue={reading.reason ?? ""}
              required
            />
          )}
          <PrivateAttachmentPicker
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            title={t("evidencePhoto")}
            emptyText={t("noNewPhoto")}
            actionLabel={t("addPhoto")}
            kind="image"
          />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">{t("saveChanges")}</Button>
          </DialogFooter>
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

const todayDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
