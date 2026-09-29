"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
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
import type { AppLocale } from "@/i18n/config";
import { formatDateTimeLocale } from "@/i18n/format";

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
  floorLabel,
  propertyLevelLabel,
  roomSpaceLabel,
  noneLabel,
}: {
  locations: AssetLocationOption[];
  defaultFloorId?: string | null;
  defaultSpaceId?: string | null;
  floorLabel: string;
  propertyLevelLabel: string;
  roomSpaceLabel: string;
  noneLabel: string;
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
      <SelectField label={floorLabel} name="floorId" value={floorId} onChange={(event) => setFloorId(event.target.value)}>
        <option value="">{propertyLevelLabel}</option>
        {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
      </SelectField>
      <SelectField label={roomSpaceLabel} name="spaceId" value={spaceId} disabled={!floorId} onChange={(event) => setSpaceId(event.target.value)}>
        <option value="">{noneLabel}</option>
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
  defaultFloorId,
  defaultSpaceId,
}: {
  propertyId: string;
  categories: AssetCategoryView[];
  locations: AssetLocationOption[];
  asset?: AssetDetailView;
  trigger?: React.ReactNode;
  defaultFloorId?: string | null;
  defaultSpaceId?: string | null;
}) {
  const t = useTranslations("assets");
  const [open, setOpen] = React.useState(false);
  const [state, action] = useDialogAction(asset ? updateAssetAction : createAssetAction, () => setOpen(false));
  const selectable = categories.filter((category) => !category.archived || category.id === asset?.categoryId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus /> {t("addAsset")}</Button>}</DialogTrigger>
      <DialogContent className="asset-dialog asset-dialog-wide">
        <DialogHeader>
          <DialogTitle>{asset ? t("editAsset") : t("addAsset")}</DialogTitle>
          <DialogDescription>{t("assetFormDescription")}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {asset && <input type="hidden" name="assetId" value={asset.id} />}
          <div className="asset-form-grid">
            <Field label={t("name")} name="name" required defaultValue={asset?.name ?? ""} />
            <SelectField label={t("category")} name="categoryId" required defaultValue={asset?.categoryId ?? ""}>
              <option value="" disabled>{t("chooseCategory")}</option>
              {selectable.map((category) => (
                <option key={category.id} value={category.id}>{category.name}{category.archived ? ` (${t("archived")})` : ""}</option>
              ))}
            </SelectField>
          </div>
          {!selectable.length && <p className="asset-inline-warning">{t("createCategoryFirst")}</p>}
          <LocationFields locations={locations} defaultFloorId={asset?.floorId ?? defaultFloorId} defaultSpaceId={asset?.spaceId ?? defaultSpaceId} floorLabel={t("floor")} propertyLevelLabel={t("propertyLevel")} roomSpaceLabel={t("roomSpace")} noneLabel={t("none")} />
          <div className="asset-form-grid asset-form-grid-3">
            <Field label={t("brand")} name="brand" defaultValue={asset?.brand ?? ""} />
            <Field label={t("model")} name="model" defaultValue={asset?.model ?? ""} />
            <Field label={t("serialNumber")} name="serialNumber" defaultValue={asset?.serialNumber ?? ""} />
          </div>
          <div className="asset-form-grid asset-form-grid-3">
            <Field label={t("purchaseDate")} name="purchaseDate" type="date" defaultValue={asset?.purchaseDate ?? ""} />
            <Field label={t("purchasePriceVnd")} name="purchasePrice" inputMode="numeric" defaultValue={asset?.purchasePriceVnd ?? ""} />
            <Field label={t("warrantyExpires")} name="warrantyExpiresAt" type="date" defaultValue={asset?.warrantyExpiresAt ?? ""} />
          </div>
          <TextareaField label={t("notes")} name="notes" defaultValue={asset?.notes ?? ""} />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit" disabled={!selectable.length}>{asset ? t("saveAsset") : t("addAsset")}</Button></DialogFooter>
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
  const t = useTranslations("assets");
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
          <DialogTitle>{t("replaceAsset")}</DialogTitle>
          <DialogDescription>{t("replaceAssetDescription", { name: asset.name })}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="assetId" value={asset.id} />
          <input type="hidden" name="propertyId" value={asset.propertyId} />
          <input type="hidden" name="categoryId" value={asset.categoryId} />
          <input type="hidden" name="floorId" value={asset.floorId ?? ""} />
          <input type="hidden" name="spaceId" value={asset.spaceId ?? ""} />
          <div className="asset-replacement-context">
            <RefreshCw />
            <span><strong>{t("inherited")}:</strong> {asset.categoryName === "Uncategorized" ? t("uncategorized") : asset.categoryName} · {asset.locationLabel === "Property" ? t("propertyLevel") : asset.locationLabel}</span>
          </div>
          <div className="asset-form-grid">
            <Field label={t("replacementName")} name="name" required />
            <Field label={t("brand")} name="brand" defaultValue={asset.brand ?? ""} />
          </div>
          <div className="asset-form-grid">
            <Field label={t("model")} name="model" />
            <Field label={t("serialNumber")} name="serialNumber" />
          </div>
          <div className="asset-form-grid asset-form-grid-3">
            <Field label={t("purchaseDate")} name="purchaseDate" type="date" />
            <Field label={t("purchasePriceVnd")} name="purchasePrice" inputMode="numeric" />
            <Field label={t("warrantyExpires")} name="warrantyExpiresAt" type="date" />
          </div>
          <TextareaField label={t("notes")} name="notes" />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit"><RefreshCw /> {t("replaceAsset")}</Button></DialogFooter>
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
  const t = useTranslations("assets");
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader>
          <DialogTitle>{t("assetCategories")}</DialogTitle>
          <DialogDescription>{t("assetCategoriesDescription")}</DialogDescription>
        </DialogHeader>
        <div className="asset-category-list">
          {categories.map((category) => <CategoryRow key={category.id} propertyId={propertyId} category={category} />)}
          {!categories.length && <p className="asset-empty-inline">{t("noCategories")}</p>}
        </div>
        <CategoryCreateForm propertyId={propertyId} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryCreateForm({ propertyId }: { propertyId: string }) {
  const t = useTranslations("assets");
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
      <Field label={t("newCategory")} name="name" placeholder={t("newCategoryPlaceholder")} required />
      <Button type="submit"><Plus /> {t("addCategory")}</Button>
      <FormMessage state={state} />
    </PreservingActionForm>
  );
}

function CategoryRow({ propertyId, category }: { propertyId: string; category: AssetCategoryView }) {
  const t = useTranslations("assets");
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
        <Button size="sm" type="submit">{t("save")}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>{t("cancel")}</Button>
        <FormMessage state={state} />
      </PreservingActionForm>
    );
  }
  return (
    <div className="asset-category-row">
      <div><strong>{category.name}</strong><span>{t("assetCount", { count: category.assetCount })}{category.archived ? ` · ${t("archived")}` : ""}</span></div>
      {!category.archived && (
        <div className="asset-category-actions">
          <Button size="icon" variant="ghost" type="button" title={t("editCategory")} aria-label={t("editCategoryFor", { name: category.name })} onClick={() => setEditing(true)}><Pencil /></Button>
          <PreservingActionForm action={archiveAction}>
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="categoryId" value={category.id} />
            <Button size="icon" variant="ghost" type="submit" title={t("archiveCategory")} aria-label={t("archiveCategoryFor", { name: category.name })}><Archive /></Button>
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
  const t = useTranslations("assets");
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<AssetAttachmentType>("PHOTO");
  const [state, action] = useDialogAction(addAssetAttachmentAction, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><FilePlus2 /> {t("addDocument")}</Button>}</DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader><DialogTitle>{t("addAssetDocument")}</DialogTitle><DialogDescription>{t("assetDocumentDescription")}</DialogDescription></DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="assetId" value={assetId} />
          <SelectField label={t("type")} name="type" value={type} onChange={(event) => setType(event.target.value as AssetAttachmentType)}>
            <option value="PHOTO">{t("photo")}</option>
            <option value="RECEIPT">{t("purchaseReceipt")}</option>
            <option value="WARRANTY">{t("warranty")}</option>
            <option value="MANUAL">{t("manual")}</option>
            <option value="SERIAL">{t("serialLabel")}</option>
            <option value="OTHER">{t("other")}</option>
          </SelectField>
          <Field label={type === "OTHER" ? t("titleField") : t("titleOptional")} name="title" required={type === "OTHER"} />
          <PrivateAttachmentPicker
            name="file"
            title={type === "PHOTO" ? t("photo") : t("privateDocument")}
            emptyText={t("noFileSelected")}
            actionLabel={t("chooseFile")}
            kind={type === "PHOTO" ? "image" : "file"}
            accept={type === "PHOTO" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
            required
          />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit">{t("addDocument")}</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function AssetAttachmentActions({ propertyId, assetId, attachment }: { propertyId: string; assetId: string; attachment: AssetAttachmentView }) {
  const t = useTranslations("assets");
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
      <a className="asset-text-link" href={attachment.url} target="_blank" rel="noreferrer">{t("view")}</a>
      <PreservingActionForm action={replaceAction}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="attachmentId" value={attachment.id} />
        <PrivateAttachmentPicker name="file" title={t("replace")} actionLabel={t("replace")} variant="inline" autoSubmit accept="image/jpeg,image/png,image/webp,application/pdf" />
      </PreservingActionForm>
      <PreservingActionForm action={removeAction}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="attachmentId" value={attachment.id} />
        <Button variant="ghost" size="icon" title={t("removeDocument")} type="submit"><Trash2 /></Button>
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
  const t = useTranslations("assets");
  const [open, setOpen] = React.useState(false);
  const [state, action] = useDialogAction(device ? updateDeviceAction : createDeviceAction, () => setOpen(false));
  const initialLinkType = device?.assetId ? "ASSET" : device?.meterId ? "METER" : device?.spaceId ? "SPACE" : "NO_LINK";
  const [linkType, setLinkType] = React.useState<"NO_LINK" | "SPACE" | "ASSET" | "METER">(initialLinkType);
  const [assetId, setAssetId] = React.useState(device?.assetId ?? "");
  const [meterId, setMeterId] = React.useState(device?.meterId ?? "");
  const [spaceTargetId, setSpaceTargetId] = React.useState(device?.spaceId ?? "");

  React.useEffect(() => {
    if (!open) {
      setLinkType(initialLinkType);
      setAssetId(device?.assetId ?? "");
      setMeterId(device?.meterId ?? "");
      setSpaceTargetId(device?.spaceId ?? "");
    }
  }, [open, device?.assetId, device?.meterId, device?.spaceId, initialLinkType]);

  const derivedLocation = React.useMemo(() => {
    if (linkType === "ASSET") {
      const asset = assetOptions.find((item) => item.id === assetId);
      if (!asset) return t("chooseAsset");
      return asset.locationLabel === "Property" ? t("propertyLevel") : asset.locationLabel;
    }
    if (linkType === "METER") {
      const meter = meterOptions.find((item) => item.id === meterId);
      return meter ? `${meter.spaceName} · ${meter.floorName}` : t("chooseMeter");
    }
    if (linkType === "SPACE") {
      const location = locations.find((item) => item.spaceId === spaceTargetId);
      return location ? `${location.spaceName} · ${location.floorName}` : t("chooseSpace");
    }
    return null;
  }, [assetId, assetOptions, linkType, locations, meterId, meterOptions, spaceTargetId, t]);

  const linkedTargetLabel = linkType === "ASSET" ? t("asset") : linkType === "METER" ? t("meter") : t("space");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus /> {t("addDevice")}</Button>}</DialogTrigger>
      <DialogContent className="asset-dialog asset-dialog-wide">
        <DialogHeader>
          <DialogTitle>{device ? t("editDevice") : t("addDevice")}</DialogTitle>
          <DialogDescription>{t("deviceFormDescription")}</DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="asset-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          {device && <input type="hidden" name="deviceId" value={device.id} />}
          <div className="asset-form-grid">
            <Field label={t("name")} name="name" required defaultValue={device?.name ?? ""} />
            <Field label={t("deviceType")} name="deviceType" required defaultValue={device?.deviceType ?? ""} placeholder={t("deviceTypePlaceholder")} />
          </div>
          <SelectField label={t("linkDeviceTo")} name="linkType" value={linkType} onChange={(event) => setLinkType(event.target.value as typeof linkType)}>
            <option value="NO_LINK">{t("noLink")}</option>
            <option value="SPACE">{t("space")}</option>
            <option value="ASSET">{t("asset")}</option>
            <option value="METER">{t("meter")}</option>
          </SelectField>
          {linkType === "NO_LINK" && (
            <LocationFields
              locations={locations}
              defaultFloorId={device?.floorId}
              defaultSpaceId={device?.spaceId}
              floorLabel={t("floor")}
              propertyLevelLabel={t("propertyLevel")}
              roomSpaceLabel={t("roomSpace")}
              noneLabel={t("none")}
            />
          )}
          {linkType === "SPACE" && (
            <SelectField label={t("space")} name="spaceId" value={spaceTargetId} required onChange={(event) => setSpaceTargetId(event.target.value)}>
              <option value="" disabled>{t("chooseSpace")}</option>
              {locations.map((location) => <option key={location.spaceId} value={location.spaceId}>{location.spaceName} · {location.floorName}</option>)}
            </SelectField>
          )}
          {linkType === "ASSET" && (
            <SelectField label={t("asset")} name="assetId" value={assetId} required onChange={(event) => setAssetId(event.target.value)}>
              <option value="" disabled>{t("chooseAsset")}</option>
              {assetOptions.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.locationLabel === "Property" ? t("propertyLevel") : asset.locationLabel}</option>)}
            </SelectField>
          )}
          {linkType === "METER" && (
            <SelectField label={t("meter")} name="meterId" value={meterId} required onChange={(event) => setMeterId(event.target.value)}>
              <option value="" disabled>{t("chooseMeter")}</option>
              {meterOptions.map((meter) => <option key={meter.id} value={meter.id}>{meter.meterNumber || t("electricityMeter")} · {meter.spaceName}</option>)}
            </SelectField>
          )}
          {derivedLocation && (
            <div className="device-derived-location">
              <span>{t("location")}</span>
              <strong>{derivedLocation}</strong>
              <small>{t("derivedFromLinked", { target: linkedTargetLabel })}</small>
            </div>
          )}
          <div className="asset-form-grid asset-form-grid-3">
            <Field label={t("externalId")} name="externalId" defaultValue={device?.externalId ?? ""} />
            <Field label={t("protocol")} name="protocol" defaultValue={device?.protocol ?? ""} placeholder={t("optionalMetadata")} />
            <SelectField label={t("status")} name="status" defaultValue={device?.status ?? "UNKNOWN"}>
              <option value="UNKNOWN">{t("unknown")}</option>
              <option value="ONLINE">{t("online")}</option>
              <option value="OFFLINE">{t("offline")}</option>
            </SelectField>
          </div>
          <Field label={t("lastSeenOptional")} name="lastSeenAt" type="datetime-local" defaultValue={device?.lastSeenAt?.slice(0, 16) ?? ""} />
          <FormMessage state={state} />
          <DialogFooter><Button type="submit">{device ? t("saveDevice") : t("addDevice")}</Button></DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveDeviceButton({ deviceId }: { deviceId: string }) {
  const t = useTranslations("assets");
  const router = useRouter();
  const [state, action] = React.useActionState(async (previous: ActionState, data: FormData) => {
    const result = await archiveDeviceAction(previous, data); if (result.ok) router.refresh(); return result;
  }, emptyActionState);
  return <PreservingActionForm action={action}><input type="hidden" name="deviceId" value={deviceId} /><Button variant="ghost" type="submit"><Archive /> {t("archiveDevice")}</Button><FormMessage state={state} /></PreservingActionForm>;
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
  const t = useTranslations("assets");
  const locale = useLocale() as AppLocale;
  const statusLabel = device.status === "ONLINE" ? t("online") : device.status === "OFFLINE" ? t("offline") : t("unknown");
  const linkLabel = device.assetName
    ? `${t("asset")} · ${device.assetName}`
    : device.meterIdentifier
      ? t("meterLinked", { identifier: device.meterIdentifier })
      : device.spaceName
        ? `${t("space")} · ${device.spaceName}`
        : t("noLink");

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="asset-dialog">
        <DialogHeader>
          <DialogTitle>{device.name}</DialogTitle>
          <DialogDescription>{device.deviceType} · {t("registryMetadataOnly")}</DialogDescription>
        </DialogHeader>
        <dl className="device-detail-list">
          <div><dt>{t("status")}</dt><dd>{statusLabel}</dd></div>
          <div><dt>{t("location")}</dt><dd>{device.locationLabel === "Property" ? t("propertyLevel") : device.locationLabel}</dd></div>
          <div><dt>{t("linkedTo")}</dt><dd>{linkLabel}</dd></div>
          <div><dt>{t("externalId")}</dt><dd>{device.externalId || t("notProvided")}</dd></div>
          <div><dt>{t("protocol")}</dt><dd>{device.protocol || t("notProvided")}</dd></div>
          <div><dt>{t("lastSeen")}</dt><dd>{device.lastSeenAt ? formatDateTimeLocale(device.lastSeenAt, locale) : t("notRecorded")}</dd></div>
        </dl>
        <DialogFooter>
          <DeviceFormDialog
            propertyId={propertyId}
            locations={locations}
            assetOptions={assetOptions}
            meterOptions={meterOptions}
            device={device}
            trigger={<Button variant="outline"><Pencil /> {t("edit")}</Button>}
          />
          <ArchiveDeviceButton deviceId={device.id} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
