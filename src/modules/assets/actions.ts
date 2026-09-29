"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";

import type { AssetAttachmentType, AssetStatus, DeviceStatus } from "./domain/types";
import {
  addAssetAttachment,
  archiveAssetCategory,
  archiveDevice,
  createAsset,
  createAssetCategory,
  createDevice,
  removeAssetAttachment,
  replaceAsset,
  replaceAssetAttachment,
  setAssetStatus,
  updateAsset,
  updateAssetCategory,
  updateDevice,
} from "./server/assets.service";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => text(data, key) || undefined;
const file = (data: FormData, key: string) => {
  const value = data.get(key);
  return value instanceof File && value.size > 0 ? value : undefined;
};

function revalidateAssets(assetId?: string) {
  revalidatePath("/assets");
  revalidatePath("/assets/devices");
  if (assetId) revalidatePath(`/assets/${assetId}`);
  revalidatePath("/operations/maintenance");
  revalidatePath("/operations/expenses");
  revalidatePath("/");
}

async function action(work: () => Promise<unknown>, success: string, assetId?: string): Promise<ActionState> {
  try {
    await work();
    revalidateAssets(assetId);
    return { ok: true, message: success };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save Assets changes." };
  }
}

function assetInput(data: FormData) {
  return {
    propertyId: text(data, "propertyId"),
    floorId: optional(data, "floorId"),
    spaceId: optional(data, "spaceId"),
    categoryId: text(data, "categoryId"),
    name: text(data, "name"),
    brand: optional(data, "brand"),
    model: optional(data, "model"),
    serialNumber: optional(data, "serialNumber"),
    purchaseDate: optional(data, "purchaseDate"),
    purchasePrice: optional(data, "purchasePrice"),
    warrantyExpiresAt: optional(data, "warrantyExpiresAt"),
    notes: optional(data, "notes"),
  };
}

export async function createAssetAction(_: ActionState, data: FormData) {
  return action(() => createAsset(assetInput(data)), "Asset added.");
}

export async function updateAssetAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => updateAsset(assetId, assetInput(data)), "Asset updated.", assetId);
}

export async function replaceAssetAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => replaceAsset(assetId, assetInput(data)), "Replacement asset created.", assetId);
}

export async function setAssetStatusAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => setAssetStatus(assetId, text(data, "status") as AssetStatus), "Asset lifecycle updated.", assetId);
}

export async function createAssetCategoryAction(_: ActionState, data: FormData) {
  return action(
    () => createAssetCategory(text(data, "propertyId"), text(data, "name"), optional(data, "description")),
    "Category added.",
  );
}

export async function updateAssetCategoryAction(_: ActionState, data: FormData) {
  return action(
    () => updateAssetCategory(text(data, "categoryId"), text(data, "propertyId"), text(data, "name"), optional(data, "description")),
    "Category updated.",
  );
}

export async function archiveAssetCategoryAction(_: ActionState, data: FormData) {
  return action(() => archiveAssetCategory(text(data, "categoryId"), text(data, "propertyId")), "Category archived.");
}

export async function addAssetAttachmentAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  const upload = file(data, "file");
  return action(
    () => {
      if (!upload) throw new Error("Choose a file to upload.");
      return addAssetAttachment({
        assetId,
        propertyId: text(data, "propertyId"),
        type: text(data, "type") as AssetAttachmentType,
        title: optional(data, "title"),
        file: upload,
      });
    },
    "Asset document added.",
    assetId,
  );
}

export async function replaceAssetAttachmentAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  const upload = file(data, "file");
  return action(
    () => {
      if (!upload) throw new Error("Choose a replacement file.");
      return replaceAssetAttachment({
        attachmentId: text(data, "attachmentId"),
        assetId,
        propertyId: text(data, "propertyId"),
        file: upload,
      });
    },
    "Asset document replaced.",
    assetId,
  );
}

export async function removeAssetAttachmentAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => removeAssetAttachment(text(data, "attachmentId"), assetId), "Asset document removed.", assetId);
}

function deviceInput(data: FormData) {
  return {
    propertyId: text(data, "propertyId"),
    floorId: optional(data, "floorId"),
    spaceId: optional(data, "spaceId"),
    assetId: optional(data, "assetId"),
    meterId: optional(data, "meterId"),
    name: text(data, "name"),
    deviceType: text(data, "deviceType"),
    externalId: optional(data, "externalId"),
    protocol: optional(data, "protocol"),
    status: text(data, "status") as DeviceStatus,
    lastSeenAt: optional(data, "lastSeenAt"),
  };
}

export async function createDeviceAction(_: ActionState, data: FormData) {
  return action(() => createDevice(deviceInput(data)), "Device registered.");
}

export async function updateDeviceAction(_: ActionState, data: FormData) {
  return action(() => updateDevice(text(data, "deviceId"), deviceInput(data)), "Device updated.");
}

export async function archiveDeviceAction(_: ActionState, data: FormData) {
  return action(() => archiveDevice(text(data, "deviceId")), "Device archived.");
}
