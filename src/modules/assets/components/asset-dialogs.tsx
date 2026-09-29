"use client";

import * as React from "react";
import { Archive, FilePlus2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import { PrivateAttachmentPicker } from "@/components/ui/private-attachment";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState, type ActionState } from "@/lib/action-state";

import {
  addAssetAttachmentAction,
  archiveAssetCategoryAction,
  archiveDeviceAction,
  createAssetAction,
  createAssetCategoryAction,
  createDeviceAction,
  removeAssetAttachmentAction,
  replaceAssetAction,
  replaceAssetAttachmentAction,
  setAssetStatusAction,
  updateAssetAction,
  updateAssetCategoryAction,
  updateDeviceAction,
} from "../actions";
import type {
  AssetAttachmentType,
  AssetAttachmentView,
  AssetCategoryView,
  AssetDetailView,
  AssetLocationOption,
  AssetOptionView,
  DeviceListItemView,
  MeterOptionView,
} from "../domain/types";

function useDialogAction(
  action: (previous: ActionState, data: FormData) => Promise<ActionState>,
  onSuccess: () => void,
) {
  const router = useRouter();
  return React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      if (result.ok) {
        onSuccess();
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
}

function formatUtcDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p>;
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  const id = React.useId();
  return (
    <div className="asset-field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

function TextareaField({ label, ...props }: React.ComponentProps<typeof Textarea> & { label: string }) {
  const id = React.useId();
  return (
    <div className="asset-field">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} {...props} />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
  required,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  required?: boolean;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="asset-field">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        required={required}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  );
}

function LocationFields({
  locations,
  defaultFloorId,
  defaultSpaceId,
}: {
  locations: AssetLocationOption[];
  defaultFloorId?: string | null;
  defaultSpaceId?: string | null;
}) {
  const initialFloor = defaultFloorId || locations.find((item) => item.spaceId === defaultSpaceId)?.floorId || "";
  const [floorId, setFloorId] = React.useState(initialFloor);
  const [spaceId, setSpaceId] = React.useState(defaultSpaceId ?? "");
  const floors = React.useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((item) => map.set(item.floorId, item.floorName));
    return [...map].map(([id, name]) => ({ id, name }));
  }, [locations]);
  const spaces = React.useMemo(
    () => (floorId ? locations.filter((item) => item.floorId === floorId) : []),
    [floorId, locations],
  );

  React.useEffect(() => {
    if (!floorId || (spaceId && !spaces.some((item) => item.spaceId === spaceId))) setSpaceId("");
  }, [floorId, spaceId, spaces]);

  return (
    <div className="asset-form-grid">
      <SelectField label="Floor" name="floorId" value={floorId} onChange={(event) => setFloorId(event.target.value)}>
        <option value="">Property level</option>
        {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
      </SelectField>
      <SelectField label="Room / space" name="spaceId" value={spaceId} disabled={!floorId} onChange={(event) => setSpaceId(event.target.value)}>
        <option value="">None</option>
        {spaces.map((space) => <option key={space.spaceId} value={space.spaceId}>{space.spaceName}</option>)}
      </SelectField>
    </div>
  );
}

export function AssetFormDialog({
  propertyId,
  categories,
  locations,
  asset,
  trigger,
}: {
  propertyId: string;
  categories: AssetCategoryView[];
  locations: AssetLocationOption[];
  asset?: AssetDetailView;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useDialogAction(asset ? updateAssetAction : createAssetAction, () => setOpen(false));
  const selectable = categories.filter((category) => !category.archived || category.id === asset?.categoryId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus /> Add asset</Button>}</DialogTrigger>
      <DialogContent className="asset-dialog asset-dialog-wide">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>Track the physical item, location, purchase information, and warranty.</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {asset && <input type="hidden" name="assetId" value={asset.id} />}
          <div className="asset-form-grid">
            <Field label="Name" name="name" required defaultValue={asset?.name ?? ""} />
            <SelectField label="Category" name="categoryId" required defaultValue={asset?.categoryId ?? ""}>
              <option value="" disabled>Choose category</option>
              {selectable.map((category) => (
                <option key={category.id} value={category.id}>{category.name}{category.archived ? " (archived)" : ""}</option>
              ))}
            </SelectField>
          </div>
          {!selectable.length && <p className="asset-inline-warning">Create an asset category before adding inventory.</p>}
          <LocationFields locations={locations} defaultFloorId={asset?.floorId} defaultSpaceId={asset?.spaceId} />
          <div className="asset-form-grid asset-form-grid-3">
            <Field label="Brand" name="brand" defaultValue={asset?.brand ?? ""} />
            <Field label="Model" name="model" defaultValue={asset?.model ?? ""} />
            <Field label="Serial number" name="serialNumber" defaultValue={asset?.serialNumber ?? ""} />
          </div>
          <div className="asset-form-grid asset-form-grid-3">
            <Field label="Purchase date" name="purchaseDate" type="date" defaultValue={asset?.purchaseDate ?? ""} />
            <Field label="Purchase price (VND)" name="purchasePrice" inputMode="numeric" defaultValue={asset?.purchasePriceVnd ?? ""} />
            <Field label="Warranty expires" name="warrantyExpiresAt" type="date" defaultValue={asset?.warrantyExpiresAt ?? ""} />
          </div>
          <TextareaField label="Notes" name="notes" defaultValue={asset?.notes ?? ""} />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit" disabled={!selectable.length}>{asset ? "Save asset" : "Add asset"}</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function ReplaceAssetDialog({
  asset,
  categories,
  locations,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  asset: AssetDetailView;
  categories: AssetCategoryView[];
  locations: AssetLocationOption[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const router = useRouter();
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await replaceAssetAction(previous, data);
      if (result.ok) {
        setOpen(false);
        router.push("/assets");
        router.refresh();
      }
      return result;
    },
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="asset-dialog asset-dialog-wide">
        <DialogHeader>
          <DialogTitle>Replace asset</DialogTitle>
          <DialogDescription>{asset.name} will be retired. The replacement is recorded as a new physical asset and keeps its own history.</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="assetId" value={asset.id} />
          <input type="hidden" name="propertyId" value={asset.propertyId} />
          <input type="hidden" name="categoryId" value={asset.categoryId} />
          <input type="hidden" name="floorId" value={asset.floorId ?? ""} />
          <input type="hidden" name="spaceId" value={asset.spaceId ?? ""} />
          <div className="asset-replacement-context">
            <RefreshCw />
            <span><strong>Inherited:</strong> {asset.categoryName} · {asset.locationLabel}</span>
          </div>
          <div className="asset-form-grid">
            <Field label="Replacement name" name="name" required />
            <Field label="Brand" name="brand" defaultValue={asset.brand ?? ""} />
          </div>
          <div className="asset-form-grid">
            <Field label="Model" name="model" />
            <Field label="Serial number" name="serialNumber" />
          </div>
          <div className="asset-form-grid asset-form-grid-3">
            <Field label="Purchase date" name="purchaseDate" type="date" />
            <Field label="Purchase price (VND)" name="purchasePrice" inputMode="numeric" />
            <Field label="Warranty expires" name="warrantyExpiresAt" type="date" />
          </div>
          <TextareaField label="Notes" name="notes" />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit"><RefreshCw /> Replace asset</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryManager({
  propertyId,
  categories,
  trigger,
}: {
  propertyId: string;
  categories: AssetCategoryView[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader>
          <DialogTitle>Asset categories</DialogTitle>
          <DialogDescription>Categories are configurable for this property. Archived categories remain on historical assets.</DialogDescription>
        </DialogHeader>
        <div className="asset-category-list">
          {categories.map((category) => <CategoryRow key={category.id} propertyId={propertyId} category={category} />)}
          {!categories.length && <p className="asset-empty-inline">No categories yet.</p>}
        </div>
        <CategoryCreateForm propertyId={propertyId} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryCreateForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await createAssetCategoryAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    }, emptyActionState,
  );
  return (
    <PreservingActionForm action={action} className="asset-category-create">
      <input type="hidden" name="propertyId" value={propertyId} />
      <Field label="New category" name="name" placeholder="e.g. Air conditioner" required />
      <Button type="submit"><Plus /> Add category</Button>
      <FormMessage state={state} />
    </PreservingActionForm>
  );
}

function CategoryRow({ propertyId, category }: { propertyId: string; category: AssetCategoryView }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [state, updateAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await updateAssetCategoryAction(previous, data);
      if (result.ok) { setEditing(false); router.refresh(); }
      return result;
    }, emptyActionState,
  );
  const [archiveState, archiveAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await archiveAssetCategoryAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    }, emptyActionState,
  );
  if (editing) {
    return (
      <PreservingActionForm action={updateAction} className="asset-category-edit">
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="categoryId" value={category.id} />
        <Input name="name" defaultValue={category.name} required />
        <Button size="sm" type="submit">Save</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        <FormMessage state={state} />
      </PreservingActionForm>
    );
  }
  return (
    <div className="asset-category-row">
      <div><strong>{category.name}</strong><span>{category.assetCount} asset{category.assetCount === 1 ? "" : "s"}{category.archived ? " · Archived" : ""}</span></div>
      {!category.archived && (
        <div className="asset-category-actions">
          <Button size="icon" variant="ghost" type="button" title="Edit category" onClick={() => setEditing(true)}><Pencil /></Button>
          <PreservingActionForm action={archiveAction}>
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="categoryId" value={category.id} />
            <Button size="icon" variant="ghost" type="submit" title="Archive category"><Archive /></Button>
          </PreservingActionForm>
        </div>
      )}
      <FormMessage state={archiveState} />
    </div>
  );
}

export function AssetLifecycleButton({ assetId, status, children, variant = "outline", onSuccess }: { assetId: string; status: "RETIRED" | "DISPOSED"; children: React.ReactNode; variant?: React.ComponentProps<typeof Button>["variant"]; onSuccess?: () => void }) {
  const router = useRouter();
  const [state, action] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await setAssetStatusAction(previous, data);
      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }
      return result;
    }, emptyActionState,
  );
  return (
    <PreservingActionForm action={action} className="asset-lifecycle-form">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant}>{children}</Button>
      <FormMessage state={state} />
    </PreservingActionForm>
  );
}

export function AssetDocumentDialog({ propertyId, assetId, trigger }: { propertyId: string; assetId: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<AssetAttachmentType>("PHOTO");
  const [state, action] = useDialogAction(addAssetAttachmentAction, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><FilePlus2 /> Add document</Button>}</DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader><DialogTitle>Add asset document</DialogTitle><DialogDescription>Files stay private and are served through protected application routes.</DialogDescription></DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="assetId" value={assetId} />
          <SelectField label="Type" name="type" value={type} onChange={(event) => setType(event.target.value as AssetAttachmentType)}>
            <option value="PHOTO">Photo</option>
            <option value="RECEIPT">Purchase receipt</option>
            <option value="WARRANTY">Warranty</option>
            <option value="MANUAL">Manual</option>
            <option value="SERIAL">Serial label</option>
            <option value="OTHER">Other</option>
          </SelectField>
          <Field label={type === "OTHER" ? "Title" : "Title (optional)"} name="title" required={type === "OTHER"} />
          <PrivateAttachmentPicker
            name="file"
            title={type === "PHOTO" ? "Photo" : "Private document"}
            emptyText="No file selected"
            actionLabel="Choose file"
            kind={type === "PHOTO" ? "image" : "file"}
            accept={type === "PHOTO" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
            required
          />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit">Add document</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function AssetAttachmentActions({ propertyId, assetId, attachment }: { propertyId: string; assetId: string; attachment: AssetAttachmentView }) {
  const router = useRouter();
  const [replaceState, replaceAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await replaceAssetAttachmentAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    }, emptyActionState,
  );
  const [removeState, removeAction] = React.useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await removeAssetAttachmentAction(previous, data);
      if (result.ok) router.refresh();
      return result;
    }, emptyActionState,
  );
  return (
    <div className="asset-document-actions">
      <a className="asset-text-link" href={attachment.url} target="_blank" rel="noreferrer">View</a>
      <PreservingActionForm action={replaceAction}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="attachmentId" value={attachment.id} />
        <PrivateAttachmentPicker name="file" title="Replace" actionLabel="Replace" variant="inline" autoSubmit accept="image/jpeg,image/png,image/webp,application/pdf" />
      </PreservingActionForm>
      <PreservingActionForm action={removeAction}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="attachmentId" value={attachment.id} />
        <Button variant="ghost" size="icon" title="Remove document" type="submit"><Trash2 /></Button>
      </PreservingActionForm>
      <FormMessage state={replaceState} /><FormMessage state={removeState} />
    </div>
  );
}

export function DeviceFormDialog({
  propertyId,
  locations,
  assetOptions,
  meterOptions,
  device,
  trigger,
}: {
  propertyId: string;
  locations: AssetLocationOption[];
  assetOptions: AssetOptionView[];
  meterOptions: MeterOptionView[];
  device?: DeviceListItemView;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useDialogAction(device ? updateDeviceAction : createDeviceAction, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus /> Add device</Button>}</DialogTrigger>
      <DialogContent className="asset-dialog asset-dialog-wide">
        <DialogHeader><DialogTitle>{device ? "Edit device" : "Add device"}</DialogTitle><DialogDescription>Registry metadata only. No realtime connection or device control is configured in Phase 7.</DialogDescription></DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {device && <input type="hidden" name="deviceId" value={device.id} />}
          <div className="asset-form-grid">
            <Field label="Name" name="name" required defaultValue={device?.name ?? ""} />
            <Field label="Device type" name="deviceType" required defaultValue={device?.deviceType ?? ""} placeholder="Smart meter, leak sensor…" />
          </div>
          <LocationFields locations={locations} defaultFloorId={device?.floorId} defaultSpaceId={device?.spaceId} />
          <div className="asset-form-grid">
            <SelectField label="Linked asset (optional)" name="assetId" defaultValue={device?.assetId ?? ""}>
              <option value="">None</option>
              {assetOptions.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.locationLabel}</option>)}
            </SelectField>
            <SelectField label="Linked meter (optional)" name="meterId" defaultValue={device?.meterId ?? ""}>
              <option value="">None</option>
              {meterOptions.map((meter) => <option key={meter.id} value={meter.id}>{meter.meterNumber || "Meter"} · {meter.spaceName}</option>)}
            </SelectField>
          </div>
          <div className="asset-form-grid asset-form-grid-3">
            <Field label="External ID" name="externalId" defaultValue={device?.externalId ?? ""} />
            <Field label="Protocol" name="protocol" defaultValue={device?.protocol ?? ""} placeholder="Optional metadata" />
            <SelectField label="Status" name="status" defaultValue={device?.status ?? "UNKNOWN"}>
              <option value="UNKNOWN">Unknown</option><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option>
            </SelectField>
          </div>
          <Field label="Last seen (optional)" name="lastSeenAt" type="datetime-local" defaultValue={device?.lastSeenAt?.slice(0, 16) ?? ""} />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit">{device ? "Save device" : "Add device"}</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveDeviceButton({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [state, action] = React.useActionState(async (previous: ActionState, data: FormData) => {
    const result = await archiveDeviceAction(previous, data); if (result.ok) router.refresh(); return result;
  }, emptyActionState);
  return <PreservingActionForm action={action}><input type="hidden" name="deviceId" value={deviceId} /><Button variant="ghost" type="submit"><Archive /> Archive</Button><FormMessage state={state} /></PreservingActionForm>;
}

export function DeviceDetailDialog({
  propertyId,
  locations,
  assetOptions,
  meterOptions,
  device,
  trigger,
}: {
  propertyId: string;
  locations: AssetLocationOption[];
  assetOptions: AssetOptionView[];
  meterOptions: MeterOptionView[];
  device: DeviceListItemView;
  trigger: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader>
          <DialogTitle>{device.name}</DialogTitle>
          <DialogDescription>{device.deviceType} · Registry metadata only</DialogDescription>
        </DialogHeader>
        <dl className="device-detail-list">
          <div><dt>Status</dt><dd>{device.status === "ONLINE" ? "Online" : device.status === "OFFLINE" ? "Offline" : "Unknown"}</dd></div>
          <div><dt>Location</dt><dd>{device.locationLabel}</dd></div>
          <div><dt>Linked asset</dt><dd>{device.assetName || "None"}</dd></div>
          <div><dt>Linked meter</dt><dd>{device.meterLabel || "None"}</dd></div>
          <div><dt>External ID</dt><dd>{device.externalId || "Not provided"}</dd></div>
          <div><dt>Protocol</dt><dd>{device.protocol || "Not provided"}</dd></div>
          <div><dt>Last seen</dt><dd>{device.lastSeenAt ? formatUtcDateTime(device.lastSeenAt) : "Not recorded"}</dd></div>
        </dl>
        <DialogFooter>
          <DeviceFormDialog
            propertyId={propertyId}
            locations={locations}
            assetOptions={assetOptions}
            meterOptions={meterOptions}
            device={device}
            trigger={<Button variant="outline"><Pencil /> Edit</Button>}
          />
          <ArchiveDeviceButton deviceId={device.id} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
