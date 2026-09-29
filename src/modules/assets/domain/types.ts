export const ASSET_STATUSES = ["ACTIVE", "RETIRED", "DISPOSED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_ATTACHMENT_TYPES = [
  "PHOTO",
  "RECEIPT",
  "WARRANTY",
  "MANUAL",
  "SERIAL",
  "OTHER",
] as const;
export type AssetAttachmentType = (typeof ASSET_ATTACHMENT_TYPES)[number];

export const DEVICE_STATUSES = ["ONLINE", "OFFLINE", "UNKNOWN"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DEVICE_LINK_TYPES = ["NO_LINK", "SPACE", "ASSET", "METER"] as const;
export type DeviceLinkType = (typeof DEVICE_LINK_TYPES)[number];

export type WarrantyState = "NO_WARRANTY" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

export type AssetLocationOption = {
  floorId: string;
  floorName: string;
  spaceId: string;
  spaceName: string;
};

export type AssetCategoryView = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  assetCount: number;
};

export type AssetOptionView = {
  id: string;
  name: string;
  floorId: string | null;
  spaceId: string | null;
  locationLabel: string;
  status: AssetStatus;
};

export type AssetListItemView = AssetOptionView & {
  categoryId: string;
  categoryName: string;
  floorName: string | null;
  spaceName: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchasePriceVnd: string | null;
  warrantyExpiresAt: string | null;
  warrantyState: WarrantyState;
  underMaintenance: boolean;
  activeMaintenanceCount: number;
};

export type AssetInventoryPageView = {
  schemaReady: boolean;
  summary: {
    active: number;
    underMaintenance: number;
    warrantyExpiring: number;
    recordedPurchaseValueVnd: string;
  };
  items: AssetListItemView[];
  categories: AssetCategoryView[];
  locations: AssetLocationOption[];
};

export type AssetAttachmentView = {
  id: string;
  type: AssetAttachmentType;
  title: string | null;
  createdAt: string;
  mediaType: "image" | "pdf";
  url: string;
};

export type AssetMaintenanceView = {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  reportedAt: string;
  completedAt: string | null;
  costVnd: string;
};

export type AssetExpenseView = {
  id: string;
  expenseDate: string;
  description: string;
  category: string;
  amountVnd: string;
  maintenanceIssueId: string | null;
  maintenanceTitle: string | null;
  hasReceipt: boolean;
};

export type AssetHistoryItemView = {
  id: string;
  date: string;
  title: string;
  detail: string | null;
  tone: "neutral" | "success" | "warning" | "info";
};

export type AssetDetailView = {
  id: string;
  propertyId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  floorId: string | null;
  floorName: string | null;
  spaceId: string | null;
  spaceName: string | null;
  locationLabel: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePriceVnd: string | null;
  warrantyExpiresAt: string | null;
  warrantyState: WarrantyState;
  notes: string | null;
  status: AssetStatus;
  underMaintenance: boolean;
  createdAt: string;
  lifetimeCostVnd: string;
  linkedExpenseTotalVnd: string;
  maintenanceSummary: { open: number; inProgress: number; completed: number };
  maintenance: AssetMaintenanceView[];
  expenses: AssetExpenseView[];
  attachments: AssetAttachmentView[];
  history: AssetHistoryItemView[];
  replacementForAsset: { id: string; name: string; status: AssetStatus } | null;
  replacedByAsset: { id: string; name: string; status: AssetStatus } | null;
};

export type MeterOptionView = {
  id: string;
  meterNumber: string | null;
  spaceId: string;
  spaceName: string;
  floorId: string;
  floorName: string;
};

export type DeviceListItemView = {
  id: string;
  name: string;
  deviceType: string;
  status: DeviceStatus;
  floorId: string | null;
  floorName: string | null;
  spaceId: string | null;
  spaceName: string | null;
  locationLabel: string;
  assetId: string | null;
  assetName: string | null;
  meterId: string | null;
  meterLabel: string | null;
  externalId: string | null;
  protocol: string | null;
  lastSeenAt: string | null;
};

export type DevicePageView = {
  schemaReady: boolean;
  summary: { total: number; online: number; offline: number; unknown: number };
  items: DeviceListItemView[];
  locations: AssetLocationOption[];
  assetOptions: AssetOptionView[];
  meterOptions: MeterOptionView[];
};

export type SpaceAssetSummaryView = {
  spaceId: string;
  assetCount: number;
  activeAssetCount: number;
  maintenanceAssetCount: number;
  deviceCount: number;
  offlineDeviceCount: number;
};
