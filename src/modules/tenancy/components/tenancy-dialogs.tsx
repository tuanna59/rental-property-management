"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  LogIn,
  LogOut,
  Plus,
  UserMinus,
  UserPlus,
  XCircle,
} from "lucide-react";

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
import type {
  DashboardPersonOption,
  DashboardSpace,
} from "@/modules/property/domain/types";

import {
  addOccupantAction,
  cancelScheduledMoveOutAction,
  cancelUpcomingMoveInAction,
  endOccupancyAction,
  moveInAction,
  moveOccupantAction,
  moveOutAction,
} from "../actions";

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MoveInDialog({
  space,
  people,
}: {
  space: DashboardSpace;
  people: DashboardPersonOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [responsible, setResponsible] = React.useState("__new");
  const [state, action] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await moveInAction(previous, formData);
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
        <Button className="w-full">
          <LogIn />
          Move in
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Move into {space.name}</DialogTitle>
          <DialogDescription>
            Select one responsible renter and any additional occupants.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="tenancy-form">
          <input type="hidden" name="spaceId" value={space.id} />
          <div className="grid gap-2">
            <Label htmlFor={`responsible-${space.id}`}>
              Responsible renter
            </Label>
            <select
              id={`responsible-${space.id}`}
              name="responsiblePersonId"
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
              <option value="__new">Create a new person</option>
            </select>
          </div>
          {responsible === "__new" && (
            <div className="new-person-fields">
              <Field label="Full name" name="newPersonName" required />
              <Field label="Phone" name="newPersonPhone" />
              <Field
                label="Citizen ID"
                name="newPersonCitizenId"
                autoComplete="off"
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Move-in date"
              name="moveInDate"
              type="date"
              defaultValue={today()}
              required
            />
            <Field label="Planned move-out" name="moveOutDate" type="date" />
            <Field
              label="Monthly rent (VND)"
              name="monthlyRentVnd"
              inputMode="numeric"
              required
            />
            <Field
              label="Deposit (VND)"
              name="depositVnd"
              inputMode="numeric"
            />
          </div>
          {people.length > 1 && (
            <fieldset className="occupant-picker">
              <legend>Additional occupants</legend>
              {people
                .filter((person) => person.id !== responsible)
                .map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      name="additionalPersonIds"
                      value={person.id}
                    />
                    {person.fullName}
                  </label>
                ))}
            </fieldset>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`move-in-notes-${space.id}`}>Notes</Label>
            <Textarea id={`move-in-notes-${space.id}`} name="moveInNotes" />
          </div>
          <fieldset className="rounded-md border border-[var(--app-border)] p-3">
            <legend className="px-1 text-sm font-medium">
              Electricity meter
            </legend>
            <p className="mb-3 text-xs text-[var(--app-text-secondary)]">
              Optional boundary reading. If no active meter exists, move-in
              continues normally.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Current reading"
                name="electricityReading"
                type="number"
                step="0.001"
              />
              <Field
                label="Meter photo"
                name="electricityPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
          </fieldset>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <Plus />
              Record move-in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveOutDialog({ space }: { space: DashboardSpace }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await moveOutAction(previous, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  if (!space.occupancy) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <LogOut />
          Move out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move out of {space.name}</DialogTitle>
          <DialogDescription>
            This closes the tenancy and active occupant periods. Historical
            records remain.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="tenancy-form">
          <input
            type="hidden"
            name="tenancyId"
            value={space.occupancy.tenancyId}
          />
          <Field
            label="Move-out date"
            name="moveOutDate"
            type="date"
            defaultValue={today()}
            required
          />
          <div className="grid gap-2">
            <Label htmlFor={`move-out-notes-${space.id}`}>Notes</Label>
            <Textarea id={`move-out-notes-${space.id}`} name="moveOutNotes" />
          </div>
          <fieldset className="rounded-md border border-[var(--app-border)] p-3">
            <legend className="px-1 text-sm font-medium">
              Electricity meter
            </legend>
            <p className="mb-3 text-xs text-[var(--app-text-secondary)]">
              Optional final boundary reading. If the meter cannot be read,
              leave this blank.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Final reading"
                name="electricityReading"
                type="number"
                step="0.001"
              />
              <div className="grid gap-2">
                <Label htmlFor={`move-out-source-${space.id}`}>Source</Label>
                <select
                  id={`move-out-source-${space.id}`}
                  name="electricityReadingSource"
                >
                  <option value="MEASURED">Measured</option>
                  <option value="ESTIMATED">Estimated</option>
                </select>
              </div>
              <Field
                label="Meter photo"
                name="electricityPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
              <Field
                label="Reason if estimated"
                name="electricityReadingReason"
              />
            </div>
          </fieldset>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <LogOut />
              Confirm move-out
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
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

export function AddOccupantDialog({
  space,
  people,
  compact = false,
}: {
  space: DashboardSpace;
  people: DashboardPersonOption[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [personId, setPersonId] = React.useState("__new");
  const [state, action] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await addOccupantAction(previous, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  if (!space.occupancy) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "default"}
          className={compact ? "occupant-add-button" : "w-full"}
        >
          <UserPlus />
          Add occupant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add additional occupant</DialogTitle>
          <DialogDescription>
            Add someone to the active tenancy in {space.name}.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="tenancy-form">
          <input
            type="hidden"
            name="tenancyId"
            value={space.occupancy.tenancyId}
          />
          <div className="grid gap-2">
            <Label htmlFor={`add-person-${space.id}`}>Person</Label>
            <select
              id={`add-person-${space.id}`}
              name="personId"
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
              <option value="__new">Create a new person</option>
            </select>
          </div>
          {personId === "__new" && (
            <div className="new-person-fields">
              <Field label="Full name" name="newPersonName" required />
              <Field label="Phone" name="newPersonPhone" />
            </div>
          )}
          <Field
            label="Participation start"
            name="startDate"
            type="date"
            defaultValue={today()}
            required
          />
          <div className="grid gap-2">
            <Label htmlFor={`add-notes-${space.id}`}>Notes</Label>
            <Textarea id={`add-notes-${space.id}`} name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <UserPlus />
              Add occupant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EndOccupancyDialog({
  membershipId,
  personName,
}: {
  membershipId: string;
  personName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await endOccupancyAction(previous, formData);
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
        <Button size="sm" variant="ghost">
          <UserMinus />
          End occupancy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End {personName}&apos;s occupancy</DialogTitle>
          <DialogDescription>
            The participation record remains in rental history.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="tenancy-form">
          <input type="hidden" name="membershipId" value={membershipId} />
          <Field
            label="End date"
            name="endDate"
            type="date"
            defaultValue={today()}
            required
          />
          <div className="grid gap-2">
            <Label htmlFor={`end-notes-${membershipId}`}>Notes</Label>
            <Textarea id={`end-notes-${membershipId}`} name="notes" />
          </div>
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <UserMinus />
              End occupancy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancellationButton({
  tenancyId,
  kind,
}: {
  tenancyId: string;
  kind: "move-in" | "move-out";
}) {
  const router = useRouter();
  const action =
    kind === "move-in"
      ? cancelUpcomingMoveInAction
      : cancelScheduledMoveOutAction;
  const [state, formAction] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await action(previous, formData);
      if (result.ok) router.refresh();
      return result;
    },
    emptyActionState,
  );
  return (
    <form action={formAction} className="cancellation-action">
      <input type="hidden" name="tenancyId" value={tenancyId} />
      <Button type="submit" variant="outline" className="w-full">
        <XCircle />
        Cancel scheduled {kind}
      </Button>
      {state.message && (
        <p className={state.ok ? "form-success" : "form-error"}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export const CancelUpcomingMoveInButton = ({
  tenancyId,
}: {
  tenancyId: string;
}) => <CancellationButton tenancyId={tenancyId} kind="move-in" />;
export const CancelScheduledMoveOutButton = ({
  tenancyId,
}: {
  tenancyId: string;
}) => <CancellationButton tenancyId={tenancyId} kind="move-out" />;

export function MoveOccupantDialog({
  membershipId,
  personName,
  rooms,
}: {
  membershipId: string;
  personName: string;
  rooms: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await moveOccupantAction(previous, formData);
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
        <Button variant="outline">
          <ArrowRightLeft />
          Move to another room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {personName}</DialogTitle>
          <DialogDescription>
            The old participation ends on the same date the new one begins.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="tenancy-form">
          <input type="hidden" name="membershipId" value={membershipId} />
          <div className="grid gap-2">
            <Label htmlFor={`destination-${membershipId}`}>
              Destination room
            </Label>
            <select
              id={`destination-${membershipId}`}
              name="destinationSpaceId"
              required
            >
              <option value="">Select room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Effective date"
            name="effectiveDate"
            type="date"
            defaultValue={today()}
            required
          />
          {state.message && (
            <p className={state.ok ? "form-success" : "form-error"}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit">
              <ArrowRightLeft />
              Move occupant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
