"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale } from "@/i18n/format";
import { Gauge } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
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
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
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
  const label = boundary.boundaryType === "MOVE_IN" ? t("moveInBoundary") : t("moveOutBoundary");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Gauge /> {t("recordBoundary")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recordBoundaryTitle", { type: label })}</DialogTitle>
          <DialogDescription>
            {t("boundaryLockedDescription", { room, tenant: boundary.tenantName })}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="tenancyId" value={boundary.tenancyId} />
          <input
            type="hidden"
            name="boundaryType"
            value={boundary.boundaryType}
          />
          <div className="dialog-grid">
            <Info
              label={t("boundaryDate")}
              value={formatDateOnlyLocale(boundary.boundaryDate, locale)}
            />
            <Info
              label={t("physicalMeter")}
              value={boundary.meterNumber || t("unnumberedMeter")}
            />
          </div>
          <div className="dialog-grid">
            <Field
              label={t("reading")}
              name="readingValue"
              type="number"
              step="1"
              required
            />
            <div className="field">
              <Label htmlFor="boundary-source">{t("source")}</Label>
              <select
                id="boundary-source"
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
            <Field label={t("estimateReason")} name="reason" required />
          )}
          <PrivateAttachmentPicker
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            title={t("boundaryPhoto")}
            emptyText={t("noPhoto")}
            actionLabel={t("addPhoto")}
            kind="image"
          />
          <div className="field">
            <Label htmlFor="boundary-notes">{t("notes")}</Label>
            <Textarea id="boundary-notes" name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">{t("saveBoundary")}</Button>
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
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <Label>{label}</Label>
      <strong>{value}</strong>
    </div>
  );
}
