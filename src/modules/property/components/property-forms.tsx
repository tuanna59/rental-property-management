"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

import {
  archiveFloorAction,
  createFloorAction,
  createSpaceAction,
  deleteFloorAction,
  reorderFloorAction,
  reorderSpaceAction,
  updateFloorAction,
  updatePropertyAction,
  updateSpaceAction,
} from "../actions";
import {
  SPACE_TYPE_OPTIONS,
  type DashboardFloor,
  type DashboardSpace,
  type PropertyShellProjection,
} from "../domain/types";
import { SPACE_TYPE_KEYS } from "./visual/building-copy";

type ServerAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function FloorActions({
  floor,
  propertyId,
}: {
  floor: DashboardFloor;
  propertyId: string;
}) {
  const t = useTranslations("building");
  return (
    <div className="floor-actions">
      <FloorReorderButton
        propertyId={propertyId}
        floorId={floor.id}
        direction="down"
        label={t("forms.moveFloorHigher")}
        icon={<ArrowUp />}
      />
      <FloorReorderButton
        propertyId={propertyId}
        floorId={floor.id}
        direction="up"
        label={t("forms.moveFloorLower")}
        icon={<ArrowDown />}
      />
      <FloorFormDialog
        mode="edit"
        floor={floor}
        propertyId={propertyId}
        trigger={
          <Button variant="ghost" size="icon" title={t("forms.editFloor")}>
            <Pencil />
            <span className="sr-only">{t("forms.editFloor")}</span>
          </Button>
        }
      />
      <SpaceFormDialog
        mode="create"
        floor={floor}
        trigger={
          <Button variant="secondary" size="sm">
            <Plus />
            {t("forms.addSpace")}
          </Button>
        }
      />
      <ArchiveOrDeleteDialog
        entityName={floor.name}
        description={
          floor.spaces.length > 0
            ? t("forms.floorHasSpaces")
            : t("forms.emptyFloorArchive")
        }
        disabled={floor.spaces.length > 0}
        archiveAction={archiveFloorAction}
        archiveHidden={{ floorId: floor.id }}
        deleteAction={deleteFloorAction}
        deleteHidden={{ floorId: floor.id }}
        canDelete={floor.spaces.length === 0}
      />
    </div>
  );
}

export function PropertyFormDialog({
  property,
  trigger,
}: {
  property: PropertyShellProjection;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("building");
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await updatePropertyAction(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Pencil />
            Property settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit property</DialogTitle>
          <DialogDescription>
            Update the basic information shown on the dashboard.
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={formAction} className="grid gap-4">
          <input type="hidden" name="propertyId" value={property.id} />
          <Field
            id="property-name"
            name="name"
            label={t("forms.name")}
            defaultValue={property.name}
            error={state.fieldErrors?.name?.[0]}
          />
          <Field
            id="property-address"
            name="addressLine1"
            label="Address"
            defaultValue={property.addressLine1 ?? ""}
            error={state.fieldErrors?.addressLine1?.[0]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="property-city"
              name="city"
              label="City"
              defaultValue={property.city ?? ""}
              error={state.fieldErrors?.city?.[0]}
            />
            <Field
              id="property-country"
              name="country"
              label="Country"
              defaultValue={property.country ?? ""}
              error={state.fieldErrors?.country?.[0]}
            />
          </div>
          <TextAreaField
            id="property-description"
            name="description"
            label="Description"
            defaultValue={property.description ?? ""}
            error={state.fieldErrors?.description?.[0]}
          />
          <FormStatus state={state} />
          <DialogFooter>
            <SubmitButton>Save property</SubmitButton>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function FloorFormDialog({
  mode,
  propertyId,
  floor,
  trigger,
}: {
  mode: "create" | "edit";
  propertyId: string;
  floor?: DashboardFloor;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("building");
  const action = mode === "create" ? createFloorAction : updateFloorAction;
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("forms.addFloor") : t("forms.editFloor")}
          </DialogTitle>
          <DialogDescription>
            {t("forms.floorOrdering")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={formAction} className="grid gap-4">
          {mode === "create" ? (
            <input type="hidden" name="propertyId" value={propertyId} />
          ) : (
            <input type="hidden" name="floorId" value={floor?.id} />
          )}
          <Field
            id={`${mode}-floor-name-${floor?.id ?? "new"}`}
            name="name"
            label={t("forms.name")}
            defaultValue={floor?.name ?? ""}
            error={state.fieldErrors?.name?.[0]}
          />
          <Field
            id={`${mode}-floor-level-${floor?.id ?? "new"}`}
            name="level"
            label={t("forms.level")}
            type="number"
            defaultValue={floor?.level ?? ""}
            error={state.fieldErrors?.level?.[0]}
          />
          <TextAreaField
            id={`${mode}-floor-notes-${floor?.id ?? "new"}`}
            name="notes"
            label={t("forms.notes")}
            defaultValue={floor?.notes ?? ""}
            error={state.fieldErrors?.notes?.[0]}
          />
          <FormStatus state={state} />
          <DialogFooter>
            <SubmitButton>
              {mode === "create" ? t("forms.addFloor") : t("forms.saveFloor")}
            </SubmitButton>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function SpaceFormDialog({
  mode,
  floor,
  space,
  trigger,
}: {
  mode: "create" | "edit";
  floor: DashboardFloor;
  space?: DashboardSpace;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("building");
  const action = mode === "create" ? createSpaceAction : updateSpaceAction;
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.ok) setOpen(false);
      return result;
    },
    emptyActionState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("forms.addSpace") : t("forms.editSpace")}
          </DialogTitle>
          <DialogDescription>{floor.name}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={formAction} className="grid gap-4">
          {mode === "create" ? (
            <input type="hidden" name="floorId" value={floor.id} />
          ) : (
            <input type="hidden" name="spaceId" value={space?.id} />
          )}
          <Field
            id={`${mode}-space-name-${space?.id ?? floor.id}`}
            name="name"
            label={t("forms.nameOrIdentifier")}
            defaultValue={space?.name ?? ""}
            error={state.fieldErrors?.name?.[0]}
          />
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-space-type-${space?.id ?? floor.id}`}>
              {t("forms.type")}
            </Label>
            <Select name="type" defaultValue={space?.type ?? "ROOM"}>
              <SelectTrigger id={`${mode}-space-type-${space?.id ?? floor.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPACE_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`spaceTypes.${SPACE_TYPE_KEYS[type]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.type?.[0] ? (
              <p className="text-sm text-[var(--app-danger)]">
                {state.fieldErrors.type[0]}
              </p>
            ) : null}
          </div>
          <TextAreaField
            id={`${mode}-space-notes-${space?.id ?? floor.id}`}
            name="notes"
            label={t("forms.notes")}
            defaultValue={space?.notes ?? ""}
            error={state.fieldErrors?.notes?.[0]}
          />
          <FormStatus state={state} />
          <DialogFooter>
            <SubmitButton>
              {mode === "create" ? t("forms.addSpace") : t("forms.saveSpace")}
            </SubmitButton>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function FloorReorderButton({
  propertyId,
  floorId,
  direction,
  label,
  icon,
}: {
  propertyId: string;
  floorId: string;
  direction: "up" | "down";
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <TinyActionForm
      action={reorderFloorAction}
      hidden={{ propertyId, floorId, direction }}
      label={label}
      icon={icon}
    />
  );
}

export function SpaceReorderButton({
  floorId,
  spaceId,
  direction,
  label,
  icon,
}: {
  floorId: string;
  spaceId: string;
  direction: "up" | "down";
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <TinyActionForm
      action={reorderSpaceAction}
      hidden={{ floorId, spaceId, direction }}
      label={label}
      icon={icon}
    />
  );
}

function TinyActionForm({
  action,
  hidden,
  label,
  icon,
}: {
  action: ServerAction;
  hidden: Record<string, string>;
  label: string;
  icon: React.ReactNode;
}) {
  const [state, formAction] = React.useActionState(action, emptyActionState);

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <PendingIconButton label={label}>{icon}</PendingIconButton>
      {!state.ok && <FormStatus state={state} />}
    </form>
  );
}

export function ArchiveOrDeleteDialog({
  entityName,
  description,
  disabled,
  archiveAction,
  archiveHidden,
  deleteAction,
  deleteHidden,
  canDelete,
}: {
  entityName: string;
  description: string;
  disabled?: boolean;
  archiveAction: ServerAction;
  archiveHidden: Record<string, string>;
  deleteAction: ServerAction;
  deleteHidden: Record<string, string>;
  canDelete: boolean;
}) {
  const t = useTranslations("building");
  const tCommon = useTranslations("common");
  const [archiveState, archiveFormAction] = React.useActionState(
    archiveAction,
    emptyActionState,
  );
  const [deleteState, deleteFormAction] = React.useActionState(
    deleteAction,
    emptyActionState,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          title={t("forms.archiveOrDelete")}
          disabled={disabled}
        >
          <Trash2 />
          <span className="sr-only">{t("forms.archiveOrDelete")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("forms.archiveOrDeleteEntity", { entity: entityName })}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <form action={archiveFormAction}>
            {Object.entries(archiveHidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Button variant="outline" className="w-full" disabled={disabled}>
              {tCommon("archive")}
            </Button>
            <FormStatus state={archiveState} />
          </form>
          {canDelete ? (
            <form action={deleteFormAction}>
              {Object.entries(deleteHidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button variant="danger" className="w-full">
                {tCommon("delete")}
              </Button>
              <FormStatus state={deleteState} />
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="text-sm text-[var(--app-danger)]">{error}</p> : null}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  error,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="text-sm text-[var(--app-danger)]">{error}</p> : null}
    </div>
  );
}

function FormStatus({ state }: { state: ActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn("text-sm", state.ok ? "text-[var(--app-brand)]" : "text-[var(--app-danger)]")}
      role={state.ok ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const t = useTranslations("building");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("forms.saving") : children}
    </Button>
  );
}
function PendingIconButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      disabled={pending}
    >
      {children}
    </Button>
  );
}
