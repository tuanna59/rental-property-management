import type { WarrantyState } from "./types";

export function warrantyState(
  expiresAt: Date | string | null | undefined,
  today = new Date(),
): WarrantyState {
  if (!expiresAt) return "NO_WARRANTY";
  const day = (value: Date | string) => {
    if (typeof value === "string") return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  };
  const expiry = day(expiresAt);
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (expiry < base) return "EXPIRED";
  const soon = new Date(base);
  soon.setUTCDate(soon.getUTCDate() + 30);
  return expiry <= soon ? "EXPIRING_SOON" : "ACTIVE";
}

export function warrantyLabel(state: WarrantyState) {
  return {
    NO_WARRANTY: "No warranty",
    ACTIVE: "Active",
    EXPIRING_SOON: "Expiring soon",
    EXPIRED: "Expired",
  }[state];
}
