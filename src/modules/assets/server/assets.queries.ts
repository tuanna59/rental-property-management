import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/presentation";
import { formatLocationLabel } from "@/lib/location";
import { getOperationsLocations } from "@/modules/operations/server/operations.queries";

import { warrantyState } from "../domain/rules";
import type {
  AssetDetailView,
  AssetInventoryPageView,
  AssetListItemView,
  AssetOptionView,
  DevicePageView,
  MeterOptionView,
  SpaceAssetSummaryView,
} from "../domain/types";
import { assetsDb, assetsSchemaReady } from "./assets-db";

function stringMoney(value: unknown): string {
  if (value === null || value === undefined) return "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.trunc(value).toString();
  if (typeof value === "string") return value.split(".")[0];
  if (typeof value === "object" && "toString" in value) {
    return String((value as { toString(): string }).toString()).split(".")[0];
  }
  return "0";
}

function addMoney(left: bigint, value: unknown) {
  try {
    return left + BigInt(stringMoney(value));
  } catch {
    return left;
  }
}

function locationLabel(item: any) {
  return formatLocationLabel({ spaceName: item.space?.name, floorName: item.floor?.name });
}

function mapAssetOption(asset: any): AssetOptionView {
  return {
    id: asset.id,
    name: asset.name,
    floorId: asset.floorId ?? null,
    spaceId: asset.spaceId ?? null,
    locationLabel: locationLabel(asset),
    status: asset.status,
  };
}

function mapAssetListItem(asset: any, today = new Date()): AssetListItemView {
  const activeMaintenance = (asset.maintenanceIssues ?? []).filter(
    (issue: any) => issue.status === "OPEN" || issue.status === "IN_PROGRESS",
  );
  return {
    ...mapAssetOption(asset),
    categoryId: asset.categoryId,
    categoryName: asset.category?.name ?? "Uncategorized",
    floorName: asset.floor?.name ?? null,
    spaceName: asset.space?.name ?? null,
    brand: asset.brand ?? null,
    model: asset.model ?? null,
    serialNumber: asset.serialNumber ?? null,
    purchasePriceVnd: asset.purchasePrice == null ? null : stringMoney(asset.purchasePrice),
    warrantyExpiresAt: asset.warrantyExpiresAt ? toDateOnly(asset.warrantyExpiresAt) : null,
    warrantyState: warrantyState(asset.warrantyExpiresAt ?? null, today),
    underMaintenance: activeMaintenance.length > 0,
    activeMaintenanceCount: activeMaintenance.length,
  };
}

export async function getAssetOptions(propertyId: string): Promise<AssetOptionView[]> {
  if (!assetsSchemaReady()) return [];
  const db = assetsDb();
  const assets = await db.asset!.findMany({
    where: { propertyId, archivedAt: null, status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    include: {
      floor: { select: { name: true } },
      space: { select: { name: true } },
    },
  });
  return assets.map(mapAssetOption);
}

export async function getAssetInventoryPage(propertyId: string): Promise<AssetInventoryPageView> {
  const locations = await getOperationsLocations(propertyId);
  if (!assetsSchemaReady()) {
    return {
      schemaReady: false,
      summary: { active: 0, underMaintenance: 0, warrantyExpiring: 0, recordedPurchaseValueVnd: "0" },
      items: [],
      categories: [],
      locations,
    };
  }
  const db = assetsDb();
  const [assets, categories] = await Promise.all([
    db.asset!.findMany({
      where: { propertyId, archivedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true } },
        floor: { select: { id: true, name: true } },
        space: { select: { id: true, name: true } },
        maintenanceIssues: {
          where: { archivedAt: null, status: { in: ["OPEN", "IN_PROGRESS"] } },
          select: { id: true, status: true },
        },
      },
    }),
    db.assetCategory!.findMany({
      where: { propertyId },
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
      include: { _count: { select: { assets: true } } },
    }),
  ]);
  const today = new Date();
  const items: AssetListItemView[] = assets.map((asset: any) => mapAssetListItem(asset, today));
  const recorded = assets.reduce(
    (sum: bigint, asset: any) => asset.status === "DISPOSED" ? sum : addMoney(sum, asset.purchasePrice),
    BigInt(0),
  );
  return {
    schemaReady: true,
    summary: {
      active: items.filter((item) => item.status === "ACTIVE").length,
      underMaintenance: items.filter((item) => item.status === "ACTIVE" && item.underMaintenance).length,
      warrantyExpiring: items.filter((item) => item.warrantyState === "EXPIRING_SOON").length,
      recordedPurchaseValueVnd: recorded.toString(),
    },
    items,
    categories: categories.map((category: any) => ({
      id: category.id,
      name: category.name,
      description: category.description ?? null,
      archived: Boolean(category.archivedAt),
      assetCount: category._count?.assets ?? 0,
    })),
    locations,
  };
}

export async function getAssetDetail(assetId: string): Promise<AssetDetailView | null> {
  if (!assetsSchemaReady()) return null;
  const db = assetsDb();
  const asset = await db.asset!.findFirst({
    where: { id: assetId, archivedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      floor: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      replacementForAsset: { select: { id: true, name: true, status: true } },
      replacedByAsset: { select: { id: true, name: true, status: true } },
      attachments: { orderBy: [{ type: "asc" }, { createdAt: "asc" }] },
      maintenanceIssues: {
        where: { archivedAt: null },
        orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
        include: { expenses: { where: { archivedAt: null }, select: { amount: true } } },
      },
      expenses: {
        where: { archivedAt: null },
        orderBy: { expenseDate: "desc" },
        include: { maintenanceIssue: { select: { id: true, title: true } } },
      },
    },
  });
  if (!asset) return null;

  let linkedExpenseTotal = BigInt(0);
  for (const expense of asset.expenses ?? []) linkedExpenseTotal = addMoney(linkedExpenseTotal, expense.amount);
  const purchase = asset.purchasePrice == null ? BigInt(0) : BigInt(stringMoney(asset.purchasePrice));
  const maintenance = (asset.maintenanceIssues ?? []).map((issue: any) => {
    const cost = (issue.expenses ?? []).reduce(
      (sum: bigint, expense: any) => addMoney(sum, expense.amount),
      BigInt(0),
    );
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      status: issue.status,
      reportedAt: toDateOnly(issue.reportedAt),
      completedAt: issue.completedAt ? toDateOnly(issue.completedAt) : null,
      costVnd: cost.toString(),
    };
  });
  const history = [
    ...(asset.purchaseDate ? [{ id: `purchase-${asset.id}`, date: toDateOnly(asset.purchaseDate), title: "Purchased", detail: asset.purchasePrice == null ? null : stringMoney(asset.purchasePrice), tone: "info" as const }] : []),
    { id: `created-${asset.id}`, date: toDateOnly(asset.createdAt), title: "Recorded in inventory", detail: null, tone: "neutral" as const },
    ...maintenance.map((issue: any) => ({ id: `maintenance-${issue.id}`, date: issue.reportedAt, title: `Maintenance · ${issue.title}`, detail: issue.status === "COMPLETED" ? "Completed" : issue.status === "IN_PROGRESS" ? "In progress" : "Open", tone: issue.status === "COMPLETED" ? "success" as const : "warning" as const })),
    ...(asset.status === "RETIRED" ? [{ id: `retired-${asset.id}`, date: toDateOnly(asset.updatedAt), title: "Retired", detail: null, tone: "warning" as const }] : []),
    ...(asset.status === "DISPOSED" ? [{ id: `disposed-${asset.id}`, date: toDateOnly(asset.updatedAt), title: "Disposed", detail: null, tone: "warning" as const }] : []),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const active = maintenance.filter((issue: any) => issue.status !== "COMPLETED");

  return {
    id: asset.id,
    propertyId: asset.propertyId,
    name: asset.name,
    categoryId: asset.categoryId,
    categoryName: asset.category?.name ?? "Uncategorized",
    floorId: asset.floorId ?? null,
    floorName: asset.floor?.name ?? null,
    spaceId: asset.spaceId ?? null,
    spaceName: asset.space?.name ?? null,
    locationLabel: locationLabel(asset),
    brand: asset.brand ?? null,
    model: asset.model ?? null,
    serialNumber: asset.serialNumber ?? null,
    purchaseDate: asset.purchaseDate ? toDateOnly(asset.purchaseDate) : null,
    purchasePriceVnd: asset.purchasePrice == null ? null : stringMoney(asset.purchasePrice),
    warrantyExpiresAt: asset.warrantyExpiresAt ? toDateOnly(asset.warrantyExpiresAt) : null,
    warrantyState: warrantyState(asset.warrantyExpiresAt ?? null),
    notes: asset.notes ?? null,
    status: asset.status,
    underMaintenance: active.length > 0,
    createdAt: toDateOnly(asset.createdAt),
    lifetimeCostVnd: (purchase + linkedExpenseTotal).toString(),
    linkedExpenseTotalVnd: linkedExpenseTotal.toString(),
    maintenanceSummary: {
      open: maintenance.filter((item: any) => item.status === "OPEN").length,
      inProgress: maintenance.filter((item: any) => item.status === "IN_PROGRESS").length,
      completed: maintenance.filter((item: any) => item.status === "COMPLETED").length,
    },
    maintenance,
    expenses: (asset.expenses ?? []).map((expense: any) => ({
      id: expense.id,
      expenseDate: toDateOnly(expense.expenseDate),
      description: expense.description,
      category: expense.category,
      amountVnd: stringMoney(expense.amount),
      maintenanceIssueId: expense.maintenanceIssueId ?? null,
      maintenanceTitle: expense.maintenanceIssue?.title ?? null,
      hasReceipt: Boolean(expense.receiptStorageKey),
    })),
    attachments: (asset.attachments ?? []).map((attachment: any) => ({
      id: attachment.id,
      type: attachment.type,
      title: attachment.title ?? null,
      createdAt: attachment.createdAt.toISOString(),
      mediaType: String(attachment.storageKey).toLowerCase().endsWith(".pdf") ? "pdf" : "image",
      url: `/api/assets/${asset.id}/attachments/${attachment.id}`,
    })),
    history,
    replacementForAsset: asset.replacementForAsset ?? null,
    replacedByAsset: asset.replacedByAsset ?? null,
  };
}

export async function getMeterOptions(propertyId: string): Promise<MeterOptionView[]> {
  const meters = await prisma.meter.findMany({
    where: { removedAt: null, space: { floor: { propertyId, archivedAt: null }, archivedAt: null } },
    orderBy: { installedAt: "desc" },
    select: {
      id: true,
      meterNumber: true,
      spaceId: true,
      space: { select: { name: true, floorId: true, floor: { select: { name: true } } } },
    },
  });
  return meters.map((meter) => ({
    id: meter.id,
    meterNumber: meter.meterNumber,
    spaceId: meter.spaceId,
    spaceName: meter.space.name,
    floorId: meter.space.floorId,
    floorName: meter.space.floor.name,
  }));
}

export async function getDevicePage(propertyId: string): Promise<DevicePageView> {
  const [locations, assetOptions, meterOptions] = await Promise.all([
    getOperationsLocations(propertyId),
    getAssetOptions(propertyId),
    getMeterOptions(propertyId),
  ]);
  if (!assetsSchemaReady()) {
    return { schemaReady: false, summary: { total: 0, online: 0, offline: 0, unknown: 0 }, items: [], locations, assetOptions, meterOptions };
  }
  const db = assetsDb();
  const devices = await db.device!.findMany({
    where: { propertyId, archivedAt: null },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      floor: { select: { name: true } },
      space: { select: { name: true } },
      asset: { select: { id: true, name: true } },
      meter: { select: { id: true, meterNumber: true } },
    },
  });
  const items = devices.map((device: any) => ({
    id: device.id,
    name: device.name,
    deviceType: device.deviceType,
    status: device.status,
    floorId: device.floorId ?? null,
    floorName: device.floor?.name ?? null,
    spaceId: device.spaceId ?? null,
    spaceName: device.space?.name ?? null,
    locationLabel: locationLabel(device),
    assetId: device.assetId ?? null,
    assetName: device.asset?.name ?? null,
    meterId: device.meterId ?? null,
    meterLabel: device.meter ? `Meter ${device.meter.meterNumber || device.meter.id.slice(-5)}` : null,
    externalId: device.externalId ?? null,
    protocol: device.protocol ?? null,
    lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
  }));
  return {
    schemaReady: true,
    summary: {
      total: items.length,
      online: items.filter((item: any) => item.status === "ONLINE").length,
      offline: items.filter((item: any) => item.status === "OFFLINE").length,
      unknown: items.filter((item: any) => item.status === "UNKNOWN").length,
    },
    items,
    locations,
    assetOptions,
    meterOptions,
  };
}

export async function getSpaceAssetSummaries(propertyId: string): Promise<SpaceAssetSummaryView[]> {
  if (!assetsSchemaReady()) return [];
  const db = assetsDb();
  const [assets, devices] = await Promise.all([
    db.asset!.findMany({
      where: { propertyId, archivedAt: null, spaceId: { not: null } },
      select: {
        spaceId: true,
        status: true,
        maintenanceIssues: {
          where: { archivedAt: null, status: { in: ["OPEN", "IN_PROGRESS"] } },
          select: { id: true },
        },
      },
    }),
    db.device!.findMany({
      where: { propertyId, archivedAt: null, spaceId: { not: null } },
      select: { spaceId: true, status: true },
    }),
  ]);
  const map = new Map<string, SpaceAssetSummaryView>();
  const ensure = (spaceId: string) => {
    const existing = map.get(spaceId);
    if (existing) return existing;
    const next = { spaceId, assetCount: 0, activeAssetCount: 0, maintenanceAssetCount: 0, deviceCount: 0, offlineDeviceCount: 0 };
    map.set(spaceId, next);
    return next;
  };
  for (const asset of assets) {
    if (!asset.spaceId) continue;
    const item = ensure(asset.spaceId);
    item.assetCount += 1;
    if (asset.status === "ACTIVE") item.activeAssetCount += 1;
    if (asset.maintenanceIssues?.length) item.maintenanceAssetCount += 1;
  }
  for (const device of devices) {
    if (!device.spaceId) continue;
    const item = ensure(device.spaceId);
    item.deviceCount += 1;
    if (device.status === "OFFLINE") item.offlineDeviceCount += 1;
  }
  return [...map.values()];
}

export async function getAssetAttachmentStorageKey(assetId: string, attachmentId: string) {
  if (!assetsSchemaReady()) return null;
  const db = assetsDb();
  const attachment = await db.assetAttachment!.findFirst({
    where: { id: attachmentId, assetId },
    select: { storageKey: true },
  });
  return attachment?.storageKey ?? null;
}
