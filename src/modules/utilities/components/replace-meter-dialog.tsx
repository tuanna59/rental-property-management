"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Repeat2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrivateAttachmentPicker } from "@/components/ui/private-attachment";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
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
  const t = useTranslations("utilities");
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
          <Repeat2 /> {t("replaceMeter")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("replaceMeter")}</DialogTitle>
          <DialogDescription>
            {t("replaceMeterDescription")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="spaceId" value={spaceId} />
          <Field
            label={t("replacementDate")}
            name="replacementDate"
            type="date"
            required
          />
          <div className="dialog-section">
            <h3>{t("oldMeter")}</h3>
            <div className="dialog-grid">
              <Field
                label={t("finalReading")}
                name="oldMeterFinalReading"
                type="number"
                step="0.001"
                placeholder={t("optional")}
              />
              <div className="field">
                <Label>{t("source")}</Label>
                <select
                  name="oldMeterFinalReadingSource"
                  value={source}
                  onChange={(event) =>
                    setSource(event.target.value as "MEASURED" | "ESTIMATED")
                  }
                >
                  <option value="MEASURED">{t("measured")}</option>
                  <option value="ESTIMATED">{t("estimated")}</option>
                </select>
              </div>
            </div>
            <PrivateAttachmentPicker
              name="oldMeterPhoto"
              accept="image/jpeg,image/png,image/webp"
              title={t("oldMeterPhoto")}
              emptyText={t("noPhoto")}
              actionLabel={t("addPhoto")}
              kind="image"
            />
          </div>
          {source === "ESTIMATED" && (
            <p className="text-xs text-[var(--app-warning)]">
              {t("replacementReasonHelp")}
            </p>
          )}
          <div className="dialog-section">
            <h3>{t("newMeter")}</h3>
            <div className="dialog-grid">
              <Field
                label={t("meterNumber")}
                name="newMeterNumber"
                placeholder={t("optional")}
              />
              <Field
                label={t("initialReading")}
                name="newMeterInitialReading"
                type="number"
                step="0.001"
                required
              />
            </div>
            <PrivateAttachmentPicker
              name="newMeterPhoto"
              accept="image/jpeg,image/png,image/webp"
              title={t("newMeterPhoto")}
              emptyText={t("noPhoto")}
              actionLabel={t("addPhoto")}
              kind="image"
            />
          </div>
          <Field label={t("reason")} name="reason" required />
          <div className="field">
            <Label>{t("notes")}</Label>
            <Textarea name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <Repeat2 /> {t("replaceMeter")}
            </Button>
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
