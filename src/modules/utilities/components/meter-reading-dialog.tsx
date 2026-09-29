"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

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

import { recordReadingAction } from "../actions";

export function MeterReadingDialog({ meterId }: { meterId: string }) {
  const t = useTranslations("utilities");
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
          <Plus /> {t("recordReadingShort")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recordReading")}</DialogTitle>
          <DialogDescription>
            {t("recordReadingDescription")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="meterId" value={meterId} />
          <div className="dialog-grid">
            <Field
              label={t("readingDate")}
              name="readingDate"
              type="date"
              defaultValue={todayDate()}
              max={todayDate()}
              required
            />
            <Field
              label={t("readingValue")}
              name="readingValue"
              type="number"
              step="0.001"
              required
            />
          </div>
          <input type="hidden" name="readingType" value="MANUAL" />
          <div className="dialog-grid">
            <div className="field">
              <Label htmlFor="reading-source">{t("source")}</Label>
              <select
                id="reading-source"
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
          </div>
          {source === "ESTIMATED" && (
            <Field
              label={t("estimateReason")}
              name="reason"
              placeholder={t("required")}
              required
            />
          )}
          <div className="dialog-grid">
            <PrivateAttachmentPicker
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              title={t("meterPhoto")}
              emptyText={t("noPhoto")}
              actionLabel={t("addPhoto")}
              kind="image"
            />
            <Field label={t("notes")} name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <Plus /> {t("recordReadingShort")}
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

const todayDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
