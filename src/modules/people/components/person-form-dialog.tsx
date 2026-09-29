"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

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
            Add person
          </Button>
        ) : (
          <Button variant="outline">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add person" : "Edit person"}
          </DialogTitle>
          <DialogDescription>
            Identity is kept separately from room assignments.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="person-form">
          {person && <input type="hidden" name="personId" value={person.id} />}
          <PersonField
            label="Full name"
            name="fullName"
            defaultValue={person?.fullName}
            required
            error={state.fieldErrors?.fullName?.[0]}
          />
          <PersonField
            label="Phone"
            name="phone"
            defaultValue={person?.phone ?? ""}
            error={state.fieldErrors?.phone?.[0]}
          />
          <PersonField
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            defaultValue={
              person?.dateOfBirth ? toDateOnly(person.dateOfBirth) : ""
            }
            error={state.fieldErrors?.dateOfBirth?.[0]}
          />
          <PersonField
            label={person?.hasCitizenId ? "Replace citizen ID" : "Citizen ID"}
            name="citizenId"
            autoComplete="off"
            error={state.fieldErrors?.citizenId?.[0]}
          />
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-notes`}>Notes</Label>
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
              {mode === "create" ? "Add person" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
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
