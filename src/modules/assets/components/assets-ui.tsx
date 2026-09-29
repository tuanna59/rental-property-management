"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { AssetStatus, DeviceStatus, WarrantyState } from "../domain/types";

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const t = useTranslations("assets");
  const label = status === "ACTIVE" ? t("active") : status === "RETIRED" ? t("retired") : t("disposed");
  return <span className={cn("asset-badge", `is-${status.toLowerCase()}`)}>{label}</span>;
}

export function WarrantyBadge({ state }: { state: WarrantyState }) {
  const t = useTranslations("assets");
  const label = state === "NO_WARRANTY" ? t("noWarranty") : state === "ACTIVE" ? t("warrantyActive") : state === "EXPIRING_SOON" ? t("warrantyExpiring") : t("warrantyExpired");
  return <span className={cn("asset-badge", `is-warranty-${state.toLowerCase()}`)}>{label}</span>;
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const t = useTranslations("assets");
  const label = status === "ONLINE" ? t("online") : status === "OFFLINE" ? t("offline") : t("unknown");
  return <span className={cn("asset-badge", `is-device-${status.toLowerCase()}`)}>{label}</span>;
}

export function UnderMaintenanceBadge() {
  const t = useTranslations("assets");
  return <span className="asset-badge is-maintenance">{t("underMaintenance")}</span>;
}
