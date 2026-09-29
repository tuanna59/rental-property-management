import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { nonNegativeWholeVnd } from "@/lib/money";
import { date, requiredText } from "@/modules/utilities/domain/validation";

import {
  ASSET_ATTACHMENT_TYPES,
  ASSET_STATUSES,
  DEVICE_STATUSES,
  type AssetAttachmentType,
  type AssetStatus,
  type DeviceStatus,
  type DeviceLinkType,
} from "../domain/types";
import { assetsDb, requireAssetsSchema } from "./assets-db";
import { removePrivateAssetFile, storeAssetAttachment } from "./private-media";

type LocationInput = {
  propertyId: string;
  floorId?: string | null;
  spaceId?: string | null;
};

type AssetInput = LocationInput & {
  categoryId: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: string | null;
  warrantyExpiresAt?: string | null;
  notes?: string | null;
};

type DeviceInput = LocationInput & {
  linkType: DeviceLinkType;
  name: string;
  deviceType: string;
  assetId?: string | null;
  meterId?: string | null;
  externalId?: string | null;
  protocol?: string | null;
  status: DeviceStatus;
  lastSeenAt?: string | null;
};

function enumValue<T extends readonly string[]>(value: string, values: T, message: string): T[number] {
  if (!(values as readonly string[]).includes(value)) throw new Error(message);
  return value as T[number];
}

async function validateLocation(input: LocationInput, client: unknown = prisma) {
  const db = client as typeof prisma;
  const property = await db.property.findFirst({
    where: { id: input.propertyId, archivedAt: null },
    select: { id: true },
  });
  if (!property) throw new Error("Property was not found.");

  let floorId = input.floorId || null;
  const spaceId = input.spaceId || null;
  if (spaceId) {
    const space = await db.space.findFirst({
      where: {
        id: spaceId,
        archivedAt: null,
        floor: { propertyId: input.propertyId, archivedAt: null },
      },
      select: { id: true, floorId: true },
    });
    if (!space) throw new Error("Selected room does not belong to this property.");
    if (floorId && floorId !== space.floorId) {
      throw new Error("Selected room does not belong to the selected floor.");
    }
    floorId = space.floorId;
  } else if (floorId) {
    const floor = await db.floor.findFirst({
      where: { id: floorId, propertyId: input.propertyId, archivedAt: null },
      select: { id: true },
    });
    if (!floor) throw new Error("Selected floor does not belong to this property.");
  }
  return { floorId, spaceId };
}

async function validateCategory(propertyId: string, categoryId: string, allowArchived = false, client: unknown = prisma) {
  const db = requireAssetsSchema(client);
  const category = await db.assetCategory!.findFirst({
    where: { id: categoryId, propertyId, ...(allowArchived ? {} : { archivedAt: null }) },
    select: { id: true },
  });
  if (!category) throw new Error("Choose an active asset category.");
  return category.id as string;
}

function optionalBusinessDate(value?: string | null) {
  return value?.trim() ? date(value) : null;
}

function optionalMoney(value?: string | null) {
  return value?.trim() ? nonNegativeWholeVnd(value) : null;
}

export async function createAssetCategory(propertyId: string, name: string, description?: string | null) {
  const db = requireAssetsSchema();
  return db.assetCategory!.create({
    data: {
      propertyId,
      name: requiredText(name, "Category name is required."),
      description: description?.trim() || null,
    },
  });
}

export async function updateAssetCategory(categoryId: string, propertyId: string, name: string, description?: string | null) {
  const db = requireAssetsSchema();
  const existing = await db.assetCategory!.findFirst({ where: { id: categoryId, propertyId } });
  if (!existing) throw new Error("Asset category was not found.");
  return db.assetCategory!.update({
    where: { id: categoryId },
    data: {
      name: requiredText(name, "Category name is required."),
      description: description?.trim() || null,
    },
  });
}

export async function archiveAssetCategory(categoryId: string, propertyId: string) {
  const db = requireAssetsSchema();
  const existing = await db.assetCategory!.findFirst({ where: { id: categoryId, propertyId } });
  if (!existing) throw new Error("Asset category was not found.");
  return db.assetCategory!.update({ where: { id: categoryId }, data: { archivedAt: new Date() } });
}

export async function createAsset(input: AssetInput) {
  const db = requireAssetsSchema();
  const location = await validateLocation(input);
  const categoryId = await validateCategory(input.propertyId, input.categoryId);
  return db.asset!.create({
    data: {
      propertyId: input.propertyId,
      floorId: location.floorId,
      spaceId: location.spaceId,
      categoryId,
      name: requiredText(input.name, "Asset name is required."),
      brand: input.brand?.trim() || null,
      model: input.model?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      purchaseDate: optionalBusinessDate(input.purchaseDate),
      purchasePrice: optionalMoney(input.purchasePrice),
      warrantyExpiresAt: optionalBusinessDate(input.warrantyExpiresAt),
      notes: input.notes?.trim() || null,
      status: "ACTIVE",
    },
  });
}

export async function updateAsset(assetId: string, input: AssetInput) {
  const db = requireAssetsSchema();
  const existing = await db.asset!.findFirst({ where: { id: assetId, propertyId: input.propertyId, archivedAt: null } });
  if (!existing) throw new Error("Asset was not found.");
  const location = await validateLocation(input);
  const categoryId = await validateCategory(input.propertyId, input.categoryId, existing.categoryId === input.categoryId);
  return db.asset!.update({
    where: { id: assetId },
    data: {
      floorId: location.floorId,
      spaceId: location.spaceId,
      categoryId,
      name: requiredText(input.name, "Asset name is required."),
      brand: input.brand?.trim() || null,
      model: input.model?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      purchaseDate: optionalBusinessDate(input.purchaseDate),
      purchasePrice: optionalMoney(input.purchasePrice),
      warrantyExpiresAt: optionalBusinessDate(input.warrantyExpiresAt),
      notes: input.notes?.trim() || null,
    },
  });
}

export async function replaceAsset(oldAssetId: string, input: AssetInput) {
  return prisma.$transaction(async (tx) => {
    const db = requireAssetsSchema(tx);
    const old = await db.asset!.findUnique({ where: { id: oldAssetId } });
    if (!old || old.archivedAt) throw new Error("Asset was not found.");
    if (old.status !== "ACTIVE") throw new Error("Only an active asset can be replaced.");
    const propertyId = old.propertyId as string;
    const location = await validateLocation(
      {
        propertyId,
        floorId: input.floorId ?? old.floorId,
        spaceId: input.spaceId ?? old.spaceId,
      },
      tx,
    );
    const categoryId = input.categoryId
      ? await validateCategory(propertyId, input.categoryId, false, tx)
      : old.categoryId;
    await db.asset!.update({ where: { id: oldAssetId }, data: { status: "RETIRED" } });
    return db.asset!.create({
      data: {
        propertyId,
        floorId: location.floorId,
        spaceId: location.spaceId,
        categoryId,
        replacementForAssetId: oldAssetId,
        name: requiredText(input.name, "Replacement asset name is required."),
        brand: input.brand?.trim() || null,
        model: input.model?.trim() || null,
        serialNumber: input.serialNumber?.trim() || null,
        purchaseDate: optionalBusinessDate(input.purchaseDate),
        purchasePrice: optionalMoney(input.purchasePrice),
        warrantyExpiresAt: optionalBusinessDate(input.warrantyExpiresAt),
        notes: input.notes?.trim() || null,
        status: "ACTIVE",
      },
    });
  });
}

export async function setAssetStatus(assetId: string, status: AssetStatus) {
  const db = requireAssetsSchema();
  const value = enumValue(status, ASSET_STATUSES, "Invalid asset status.");
  const asset = await db.asset!.findUnique({ where: { id: assetId } });
  if (!asset || asset.archivedAt) throw new Error("Asset was not found.");
  if (value === "ACTIVE") throw new Error("Phase 7 does not support restoring retired/disposed assets.");
  if (asset.status === "DISPOSED") throw new Error("Disposed assets are historical and cannot be changed.");
  return db.asset!.update({ where: { id: assetId }, data: { status: value } });
}

export async function addAssetAttachment(input: {
  assetId: string;
  propertyId: string;
  type: AssetAttachmentType;
  title?: string | null;
  file: File;
}) {
  const db = requireAssetsSchema();
  const type = enumValue(input.type, ASSET_ATTACHMENT_TYPES, "Choose a document type.");
  const asset = await db.asset!.findFirst({ where: { id: input.assetId, propertyId: input.propertyId, archivedAt: null } });
  if (!asset) throw new Error("Asset was not found.");
  if (!input.file || input.file.size <= 0) throw new Error("Choose a file to upload.");
  if (type === "OTHER" && !input.title?.trim()) throw new Error("A title is required for Other documents.");
  const storageKey = await storeAssetAttachment(input.propertyId, input.assetId, type, input.file);
  try {
    return await db.assetAttachment!.create({
      data: { assetId: input.assetId, type, title: input.title?.trim() || null, storageKey },
    });
  } catch (error) {
    await removePrivateAssetFile(storageKey);
    throw error;
  }
}

export async function replaceAssetAttachment(input: {
  attachmentId: string;
  assetId: string;
  propertyId: string;
  file: File;
}) {
  const db = requireAssetsSchema();
  const existing = await db.assetAttachment!.findFirst({
    where: { id: input.attachmentId, assetId: input.assetId, asset: { propertyId: input.propertyId } },
  });
  if (!existing) throw new Error("Asset document was not found.");
  const next = await storeAssetAttachment(input.propertyId, input.assetId, existing.type, input.file);
  try {
    const result = await db.assetAttachment!.update({ where: { id: input.attachmentId }, data: { storageKey: next } });
    await removePrivateAssetFile(existing.storageKey);
    return result;
  } catch (error) {
    await removePrivateAssetFile(next);
    throw error;
  }
}

export async function removeAssetAttachment(attachmentId: string, assetId: string) {
  const db = requireAssetsSchema();
  const existing = await db.assetAttachment!.findFirst({ where: { id: attachmentId, assetId } });
  if (!existing) throw new Error("Asset document was not found.");
  await db.assetAttachment!.delete({ where: { id: attachmentId } });
  await removePrivateAssetFile(existing.storageKey);
}

async function validateAssetLink(propertyId: string, assetId?: string | null, client: unknown = prisma) {
  if (!assetId) return null;
  const db = requireAssetsSchema(client);
  const asset = await db.asset!.findFirst({
    where: { id: assetId, propertyId, archivedAt: null },
    select: { id: true, floorId: true, spaceId: true },
  });
  if (!asset) throw new Error("Linked asset was not found.");
  return asset;
}

async function validateMeterLink(propertyId: string, meterId?: string | null, client: unknown = prisma) {
  if (!meterId) return null;
  const db = client as typeof prisma;
  const meter = await db.meter.findFirst({
    where: { id: meterId, space: { floor: { propertyId } } },
    select: { id: true, spaceId: true, space: { select: { floorId: true } } },
  });
  if (!meter) throw new Error("Linked meter was not found.");
  return { id: meter.id, spaceId: meter.spaceId, floorId: meter.space.floorId };
}

async function resolveDeviceLink(input: DeviceInput) {
  switch (input.linkType) {
    case "ASSET": {
      if (!input.assetId) throw new Error("Choose an asset to link this device.");
      const asset = await validateAssetLink(input.propertyId, input.assetId);
      if (!asset) throw new Error("Linked asset was not found.");
      return { floorId: asset.floorId ?? null, spaceId: asset.spaceId ?? null, assetId: asset.id, meterId: null };
    }
    case "METER": {
      if (!input.meterId) throw new Error("Choose a meter to link this device.");
      const meter = await validateMeterLink(input.propertyId, input.meterId);
      if (!meter) throw new Error("Linked meter was not found.");
      return { floorId: meter.floorId, spaceId: meter.spaceId, assetId: null, meterId: meter.id };
    }
    case "SPACE": {
      if (!input.spaceId) throw new Error("Choose a space to link this device.");
      const location = await validateLocation({ propertyId: input.propertyId, spaceId: input.spaceId });
      return { ...location, assetId: null, meterId: null };
    }
    case "NO_LINK": {
      const location = await validateLocation({ propertyId: input.propertyId, floorId: input.floorId, spaceId: input.spaceId });
      return { ...location, assetId: null, meterId: null };
    }
    default:
      throw new Error("Choose how this device is linked.");
  }
}

export async function createDevice(input: DeviceInput) {
  const db = requireAssetsSchema();
  const link = await resolveDeviceLink(input);
  return db.device!.create({
    data: {
      propertyId: input.propertyId,
      floorId: link.floorId,
      spaceId: link.spaceId,
      assetId: link.assetId,
      meterId: link.meterId,
      name: requiredText(input.name, "Device name is required."),
      deviceType: requiredText(input.deviceType, "Device type is required."),
      externalId: input.externalId?.trim() || null,
      protocol: input.protocol?.trim() || null,
      status: enumValue(input.status, DEVICE_STATUSES, "Choose a device status."),
      lastSeenAt: input.lastSeenAt?.trim() ? new Date(input.lastSeenAt) : null,
    },
  });
}

export async function updateDevice(deviceId: string, input: DeviceInput) {
  const db = requireAssetsSchema();
  const existing = await db.device!.findFirst({ where: { id: deviceId, propertyId: input.propertyId, archivedAt: null } });
  if (!existing) throw new Error("Device was not found.");
  const link = await resolveDeviceLink(input);
  return db.device!.update({
    where: { id: deviceId },
    data: {
      floorId: link.floorId,
      spaceId: link.spaceId,
      assetId: link.assetId,
      meterId: link.meterId,
      name: requiredText(input.name, "Device name is required."),
      deviceType: requiredText(input.deviceType, "Device type is required."),
      externalId: input.externalId?.trim() || null,
      protocol: input.protocol?.trim() || null,
      status: enumValue(input.status, DEVICE_STATUSES, "Choose a device status."),
      lastSeenAt: input.lastSeenAt?.trim() ? new Date(input.lastSeenAt) : null,
    },
  });
}

export async function archiveDevice(deviceId: string) {
  const db = requireAssetsSchema();
  return db.device!.update({ where: { id: deviceId }, data: { archivedAt: new Date() } });
}
