"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { getActionFeedback } from "@/i18n/action-feedback";

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

async function action(work: () => Promise<unknown>, successKey: string, assetId?: string): Promise<ActionState> {
  const feedback = await getActionFeedback("assets");
  try {
    await work();
    revalidateAssets(assetId);
    return { ok: true, message: feedback(successKey) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : feedback("saveFailed") };
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
  return action(() => createAsset(assetInput(data)), "assetAdded");
}

export async function updateAssetAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => updateAsset(assetId, assetInput(data)), "assetUpdated", assetId);
}

export async function replaceAssetAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => replaceAsset(assetId, assetInput(data)), "replacementCreated", assetId);
}

export async function setAssetStatusAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => setAssetStatus(assetId, text(data, "status") as AssetStatus), "lifecycleUpdated", assetId);
}

export async function createAssetCategoryAction(_: ActionState, data: FormData) {
  return action(
    () => createAssetCategory(text(data, "propertyId"), text(data, "name"), optional(data, "description")),
    "categoryAdded",
  );
}

export async function updateAssetCategoryAction(_: ActionState, data: FormData) {
  return action(
    () => updateAssetCategory(text(data, "categoryId"), text(data, "propertyId"), text(data, "name"), optional(data, "description")),
    "categoryUpdated",
  );
}

export async function archiveAssetCategoryAction(_: ActionState, data: FormData) {
  return action(() => archiveAssetCategory(text(data, "categoryId"), text(data, "propertyId")), "categoryArchived");
}

export async function addAssetAttachmentAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  const upload = file(data, "file");
  const feedback = await getActionFeedback("assets");
  return action(
    () => {
      if (!upload) throw new Error(feedback("chooseFile"));
      return addAssetAttachment({
        assetId,
        propertyId: text(data, "propertyId"),
        type: text(data, "type") as AssetAttachmentType,
        title: optional(data, "title"),
        file: upload,
      });
    },
    "documentAdded",
    assetId,
  );
}

export async function replaceAssetAttachmentAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  const upload = file(data, "file");
  const feedback = await getActionFeedback("assets");
  return action(
    () => {
      if (!upload) throw new Error(feedback("chooseReplacementFile"));
      return replaceAssetAttachment({
        attachmentId: text(data, "attachmentId"),
        assetId,
        propertyId: text(data, "propertyId"),
        file: upload,
      });
    },
    "documentReplaced",
    assetId,
  );
}

export async function removeAssetAttachmentAction(_: ActionState, data: FormData) {
  const assetId = text(data, "assetId");
  return action(() => removeAssetAttachment(text(data, "attachmentId"), assetId), "documentRemoved", assetId);
}

function deviceInput(data: FormData) {
  return {
    propertyId: text(data, "propertyId"),
    floorId: optional(data, "floorId"),
    spaceId: optional(data, "spaceId"),
    linkType: text(data, "linkType") as "NO_LINK" | "SPACE" | "ASSET" | "METER",
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
  return action(() => createDevice(deviceInput(data)), "deviceRegistered");
}

export async function updateDeviceAction(_: ActionState, data: FormData) {
  return action(() => updateDevice(text(data, "deviceId"), deviceInput(data)), "deviceUpdated");
}

export async function archiveDeviceAction(_: ActionState, data: FormData) {
  return action(() => archiveDevice(text(data, "deviceId")), "deviceArchived");
}
