"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
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
import { toDateOnly } from "@/lib/presentation";

import { createPersonAction, updatePersonAction } from "../actions";
import type { DirectoryPerson } from "./tenant-view";

export function PersonFormDialog({
  mode,
  person,
}: {
  mode: "create" | "edit";
  person?: DirectoryPerson;
}) {
  const t = useTranslations("tenants");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const action = mode === "create" ? createPersonAction : updatePersonAction;
  const [state, formAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus />
            {t("addPerson")}
          </Button>
        ) : (
          <Button variant="outline">{t("edit")}</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("addPerson") : t("editPerson")}
          </DialogTitle>
          <DialogDescription>
            {t("identitySeparate")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={formAction} className="person-form">
          {person && <input type="hidden" name="personId" value={person.id} />}
          <PersonField
            label={t("fullName")}
            name="fullName"
            defaultValue={person?.fullName}
            required
            error={state.fieldErrors?.fullName?.[0]}
          />
          <PersonField
            label={t("phone")}
            name="phone"
            defaultValue={person?.phone ?? ""}
            error={state.fieldErrors?.phone?.[0]}
          />
          <PersonField
            label={t("dateOfBirth")}
            name="dateOfBirth"
            type="date"
            defaultValue={
              person?.dateOfBirth ? toDateOnly(person.dateOfBirth) : ""
            }
            error={state.fieldErrors?.dateOfBirth?.[0]}
          />
          <PersonField
            label={person?.hasCitizenId ? t("replaceCitizenId") : t("citizenId")}
            name="citizenId"
            autoComplete="off"
            error={state.fieldErrors?.citizenId?.[0]}
          />
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-notes`}>{t("notes")}</Label>
            <Textarea
              id={`${mode}-notes`}
              name="notes"
              defaultValue={person?.notes ?? ""}
            />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              {mode === "create" ? t("addPerson") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function PersonField({
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  const id = React.useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
