import { cn } from "@/lib/utils";
import { warrantyLabel } from "../domain/rules";
import type { AssetStatus, DeviceStatus, WarrantyState } from "../domain/types";

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <span className={cn("asset-badge", `is-${status.toLowerCase()}`)}>{status === "ACTIVE" ? "Active" : status === "RETIRED" ? "Retired" : "Disposed"}</span>;
}

export function WarrantyBadge({ state }: { state: WarrantyState }) {
  return <span className={cn("asset-badge", `is-warranty-${state.toLowerCase()}`)}>{warrantyLabel(state)}</span>;
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return <span className={cn("asset-badge", `is-device-${status.toLowerCase()}`)}>{status === "ONLINE" ? "Online" : status === "OFFLINE" ? "Offline" : "Unknown"}</span>;
}

export function UnderMaintenanceBadge() {
  return <span className="asset-badge is-maintenance">Under maintenance</span>;
}
