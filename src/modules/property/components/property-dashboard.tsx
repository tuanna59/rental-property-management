"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Home,
  Layers3,
  Pencil,
  Plus,
  Trash2,
  Warehouse,
} from "lucide-react";

import { emptyActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveFloorAction,
  archiveSpaceAction,
  createFloorAction,
  createSpaceAction,
  deleteFloorAction,
  deleteSpaceAction,
  reorderFloorAction,
  reorderSpaceAction,
  updateFloorAction,
  updatePropertyAction,
  updateSpaceAction,
} from "../actions";
import {
  SPACE_TYPE_LABELS,
  SPACE_TYPE_OPTIONS,
  type DashboardFloor,
  type DashboardProperty,
  type DashboardSpace,
  type SpaceTypeValue,
} from "../domain/types";

type ServerAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

type DashboardProps = {
  property: DashboardProperty;
};

const spaceTone: Record<SpaceTypeValue, string> = {
  ROOM: "border-[#7fb29d] bg-[#e7f1eb] text-[#143f35]",
  OWNER_HOME: "border-[#d38c62] bg-[#fbebdf] text-[#6b2d17]",
  GARAGE: "border-[#9ba8ad] bg-[#edf1f2] text-[#26383d]",
  ROOFTOP: "border-[#c8ad57] bg-[#fff6d8] text-[#5c4917]",
  COMMON_AREA: "border-[#82a8ce] bg-[#e7f0f8] text-[#143c63]",
  STORAGE: "border-[#a898bf] bg-[#f1ecf7] text-[#403155]",
  OTHER: "border-[#b7bdb3] bg-[#f0f2ee] text-[#353b31]",
};

const spaceIcon: Record<
  SpaceTypeValue,
  React.ComponentType<{ className?: string }>
> = {
  ROOM: Home,
  OWNER_HOME: Home,
  GARAGE: Warehouse,
  ROOFTOP: Layers3,
  COMMON_AREA: Building2,
  STORAGE: Warehouse,
  OTHER: Building2,
};

export function PropertyDashboard({ property }: DashboardProps) {
  const [selectedSpaceId, setSelectedSpaceId] = React.useState(
    property.floors.flatMap((floor) => floor.spaces)[0]?.id ?? "",
  );

  const allSpaces = property.floors.flatMap((floor) => floor.spaces);
  const activeSelectedSpaceId = allSpaces.some(
    (space) => space.id === selectedSpaceId,
  )
    ? selectedSpaceId
    : (allSpaces[0]?.id ?? "");

  let selected: { floor: DashboardFloor; space: DashboardSpace } | null = null;
  for (const floor of property.floors) {
    const space = floor.spaces.find(
      (item) => item.id === activeSelectedSpaceId,
    );
    if (space) {
      selected = { floor, space };
      break;
    }
  }

  const displayFloors = [...property.floors].sort(
    (a, b) => b.sortOrder - a.sortOrder,
  );

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#172520]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-[#d8ded8] bg-white/85 px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b4a2d]">
              Property
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#10221d]">
              {property.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#65756d]">
              {[property.addressLine1, property.city, property.country]
                .filter(Boolean)
                .join(", ") || "Address not set"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PropertyFormDialog property={property} />
            <FloorFormDialog
              mode="create"
              propertyId={property.id}
              trigger={
                <Button>
                  <Plus />
                  Add floor
                </Button>
              }
            />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section
            aria-label="Building visualization"
            className="relative overflow-hidden rounded-lg border border-[#d8ded8] bg-[#fcfbf7] p-4 shadow-sm sm:p-6"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(223,234,225,0.8),rgba(252,251,247,0))]" />
            <div className="relative">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#5a6b62]">
                    Building structure
                  </p>
                  <p className="text-2xl font-semibold tracking-normal">
                    {property.floors.length} floors,{" "}
                    {property.floors.reduce(
                      (total, floor) => total + floor.spaces.length,
                      0,
                    )}{" "}
                    spaces
                  </p>
                </div>
                <p className="max-w-sm text-sm text-[#65756d]">
                  Layout is generated from property data, ordered by floor and
                  space configuration.
                </p>
              </div>

              {displayFloors.length === 0 ? (
                <EmptyBuilding propertyId={property.id} />
              ) : (
                <div className="building-cutaway mx-auto flex max-w-5xl flex-col gap-3">
                  {displayFloors.map((floor, visualIndex) => (
                    <FloorBand
                      key={floor.id}
                      floor={floor}
                      propertyId={property.id}
                      visualIndex={visualIndex}
                      selectedSpaceId={activeSelectedSpaceId}
                      onSelectSpace={setSelectedSpaceId}
                    />
                  ))}
                  <div className="mx-auto h-4 w-[92%] rounded-b-lg bg-[#d8d1c5] shadow-[0_14px_30px_rgba(48,58,54,0.16)]" />
                </div>
              )}
            </div>
          </section>

          <SpaceDetailPanel selected={selected} />
        </div>
      </div>
    </main>
  );
}

function EmptyBuilding({ propertyId }: { propertyId: string }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[#cfd9d1] bg-white/65 p-8 text-center">
      <Building2 className="size-10 text-[#7b8b83]" />
      <div>
        <h2 className="text-xl font-semibold">No floors configured</h2>
        <p className="mt-1 text-sm text-[#65756d]">
          Add the first floor to start shaping this property.
        </p>
      </div>
      <FloorFormDialog
        mode="create"
        propertyId={propertyId}
        trigger={
          <Button>
            <Plus />
            Add floor
          </Button>
        }
      />
    </div>
  );
}

function FloorBand({
  floor,
  propertyId,
  visualIndex,
  selectedSpaceId,
  onSelectSpace,
}: {
  floor: DashboardFloor;
  propertyId: string;
  visualIndex: number;
  selectedSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: visualIndex * 0.04 }}
      className="group relative"
    >
      <div className="absolute inset-x-5 bottom-[-9px] h-5 rounded-b-lg bg-[#b9c3bc]" />
      <div className="relative rounded-lg border border-[#ccd7cf] bg-white p-3 shadow-[0_14px_30px_rgba(48,58,54,0.08)] transition-shadow group-hover:shadow-[0_18px_38px_rgba(48,58,54,0.14)]">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-normal">
              {floor.name}
            </h2>
            <p className="text-xs text-[#66766e]">
              {floor.level === null ? "Level not set" : `Level ${floor.level}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FloorReorderButton
              propertyId={propertyId}
              floorId={floor.id}
              direction="down"
              label="Move floor higher"
              icon={<ArrowUp />}
            />
            <FloorReorderButton
              propertyId={propertyId}
              floorId={floor.id}
              direction="up"
              label="Move floor lower"
              icon={<ArrowDown />}
            />
            <FloorFormDialog
              mode="edit"
              floor={floor}
              propertyId={propertyId}
              trigger={
                <Button variant="ghost" size="icon" title="Edit floor">
                  <Pencil />
                  <span className="sr-only">Edit floor</span>
                </Button>
              }
            />
            <SpaceFormDialog
              mode="create"
              floor={floor}
              trigger={
                <Button variant="secondary" size="sm">
                  <Plus />
                  Space
                </Button>
              }
            />
            <ArchiveOrDeleteDialog
              entityName={floor.name}
              description={
                floor.spaces.length > 0
                  ? "This floor still has active spaces, so it cannot be archived or deleted yet."
                  : "Archive keeps history. Delete removes this empty floor."
              }
              disabled={floor.spaces.length > 0}
              archiveAction={archiveFloorAction}
              archiveHidden={{ floorId: floor.id }}
              deleteAction={deleteFloorAction}
              deleteHidden={{ floorId: floor.id }}
              canDelete={floor.spaces.length === 0}
            />
          </div>
        </div>

        {floor.spaces.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#cfd9d1] bg-[#f8faf7] px-4 py-6 text-center text-sm text-[#65756d]">
            No spaces on this floor.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {floor.spaces.map((space) => (
              <SpaceTile
                key={space.id}
                space={space}
                selected={space.id === selectedSpaceId}
                onSelect={() => onSelectSpace(space.id)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SpaceTile({
  space,
  selected,
  onSelect,
}: {
  space: DashboardSpace;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = spaceIcon[space.type];

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        "min-h-24 rounded-md border px-3 py-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5b]",
        spaceTone[space.type],
        selected && "ring-2 ring-[#1f6f5b] ring-offset-2",
      )}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{space.name}</p>
          <p className="mt-1 text-xs opacity-75">
            {SPACE_TYPE_LABELS[space.type]}
          </p>
        </div>
        <Icon className="size-5 shrink-0 opacity-75" />
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-white/70" />
    </motion.button>
  );
}

function SpaceDetailPanel({
  selected,
}: {
  selected: { floor: DashboardFloor; space: DashboardSpace } | null;
}) {
  if (!selected) {
    return (
      <aside className="rounded-lg border border-[#d8ded8] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Space details</h2>
        <p className="mt-2 text-sm text-[#65756d]">
          Select a space from the building to view details.
        </p>
      </aside>
    );
  }

  const { floor, space } = selected;

  return (
    <aside className="rounded-lg border border-[#d8ded8] bg-white p-5 shadow-sm lg:sticky lg:top-5 lg:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b4a2d]">
            Selected space
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">
            {space.name}
          </h2>
        </div>
        <SpaceFormDialog
          mode="edit"
          floor={floor}
          space={space}
          trigger={
            <Button variant="outline" size="icon" title="Edit space">
              <Pencil />
              <span className="sr-only">Edit space</span>
            </Button>
          }
        />
      </div>

      <dl className="mt-6 grid gap-4">
        <DetailRow label="Type" value={SPACE_TYPE_LABELS[space.type]} />
        <DetailRow label="Floor" value={floor.name} />
        <DetailRow
          label="Status"
          value={space.type === "ROOM" ? "Available" : "Configured"}
        />
        {space.notes ? <DetailRow label="Notes" value={space.notes} /> : null}
      </dl>

      <div className="mt-6 border-t border-[#e1e6e1] pt-4">
        <p className="text-sm font-medium text-[#263d36]">Order in floor</p>
        <div className="mt-3 flex gap-2">
          <SpaceReorderButton
            floorId={floor.id}
            spaceId={space.id}
            direction="up"
            label="Move space left"
            icon={<ArrowUp className="-rotate-90" />}
          />
          <SpaceReorderButton
            floorId={floor.id}
            spaceId={space.id}
            direction="down"
            label="Move space right"
            icon={<ArrowDown className="-rotate-90" />}
          />
        </div>
      </div>

      <div className="mt-6 border-t border-[#e1e6e1] pt-4">
        <ArchiveOrDeleteDialog
          entityName={space.name}
          description="Archive keeps this space out of active views. Delete removes it from the database."
          archiveAction={archiveSpaceAction}
          archiveHidden={{ spaceId: space.id }}
          deleteAction={deleteSpaceAction}
          deleteHidden={{ spaceId: space.id }}
          canDelete
        />
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#f7f9f6] px-3 py-3">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[#718079]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[#1d2d29]">{value}</dd>
    </div>
  );
}

function PropertyFormDialog({ property }: { property: DashboardProperty }) {
  const [state, formAction] = React.useActionState(
    updatePropertyAction,
    emptyActionState,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil />
          Edit property
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit property</DialogTitle>
          <DialogDescription>
            Update the basic information shown on the dashboard.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="propertyId" value={property.id} />
          <Field
            id="property-name"
            name="name"
            label="Name"
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
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FloorFormDialog({
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
  const action = mode === "create" ? createFloorAction : updateFloorAction;
  const [state, formAction] = React.useActionState(action, emptyActionState);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add floor" : "Edit floor"}
          </DialogTitle>
          <DialogDescription>
            Floors are ordered independently for each property.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {mode === "create" ? (
            <input type="hidden" name="propertyId" value={propertyId} />
          ) : (
            <input type="hidden" name="floorId" value={floor?.id} />
          )}
          <Field
            id={`${mode}-floor-name-${floor?.id ?? "new"}`}
            name="name"
            label="Name"
            defaultValue={floor?.name ?? ""}
            error={state.fieldErrors?.name?.[0]}
          />
          <Field
            id={`${mode}-floor-level-${floor?.id ?? "new"}`}
            name="level"
            label="Level"
            type="number"
            defaultValue={floor?.level ?? ""}
            error={state.fieldErrors?.level?.[0]}
          />
          <TextAreaField
            id={`${mode}-floor-notes-${floor?.id ?? "new"}`}
            name="notes"
            label="Notes"
            defaultValue={floor?.notes ?? ""}
            error={state.fieldErrors?.notes?.[0]}
          />
          <FormStatus state={state} />
          <DialogFooter>
            <SubmitButton>
              {mode === "create" ? "Add floor" : "Save floor"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SpaceFormDialog({
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
  const action = mode === "create" ? createSpaceAction : updateSpaceAction;
  const [state, formAction] = React.useActionState(action, emptyActionState);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add space" : "Edit space"}
          </DialogTitle>
          <DialogDescription>{floor.name}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {mode === "create" ? (
            <input type="hidden" name="floorId" value={floor.id} />
          ) : (
            <input type="hidden" name="spaceId" value={space?.id} />
          )}
          <Field
            id={`${mode}-space-name-${space?.id ?? floor.id}`}
            name="name"
            label="Name or identifier"
            defaultValue={space?.name ?? ""}
            error={state.fieldErrors?.name?.[0]}
          />
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-space-type-${space?.id ?? floor.id}`}>
              Type
            </Label>
            <Select name="type" defaultValue={space?.type ?? "ROOM"}>
              <SelectTrigger id={`${mode}-space-type-${space?.id ?? floor.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPACE_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SPACE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.type?.[0] ? (
              <p className="text-sm text-[#9f2d20]">
                {state.fieldErrors.type[0]}
              </p>
            ) : null}
          </div>
          <TextAreaField
            id={`${mode}-space-notes-${space?.id ?? floor.id}`}
            name="notes"
            label="Notes"
            defaultValue={space?.notes ?? ""}
            error={state.fieldErrors?.notes?.[0]}
          />
          <FormStatus state={state} />
          <DialogFooter>
            <SubmitButton>
              {mode === "create" ? "Add space" : "Save space"}
            </SubmitButton>
          </DialogFooter>
        </form>
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

function SpaceReorderButton({
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
  const [, formAction] = React.useActionState(action, emptyActionState);

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button variant="ghost" size="icon" title={label}>
        {icon}
        <span className="sr-only">{label}</span>
      </Button>
    </form>
  );
}

function ArchiveOrDeleteDialog({
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
          title="Archive or delete"
          disabled={disabled}
        >
          <Trash2 />
          <span className="sr-only">Archive or delete</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive or delete {entityName}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <form action={archiveFormAction}>
            {Object.entries(archiveHidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Button variant="outline" className="w-full" disabled={disabled}>
              Archive
            </Button>
            <FormStatus state={archiveState} />
          </form>
          {canDelete ? (
            <form action={deleteFormAction}>
              {Object.entries(deleteHidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button variant="danger" className="w-full">
                Delete
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
      {error ? <p className="text-sm text-[#9f2d20]">{error}</p> : null}
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
      {error ? <p className="text-sm text-[#9f2d20]">{error}</p> : null}
    </div>
  );
}

function FormStatus({ state }: { state: ActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn("text-sm", state.ok ? "text-[#1f6f5b]" : "text-[#9f2d20]")}
      role={state.ok ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : children}
    </Button>
  );
}
