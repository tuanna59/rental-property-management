import type { SpaceTypeValue } from "../../domain/types";

export const SPACE_TYPE_KEYS: Record<SpaceTypeValue, "room" | "ownerHome" | "garage" | "rooftop" | "commonArea" | "storage" | "other"> = {
  ROOM: "room",
  OWNER_HOME: "ownerHome",
  GARAGE: "garage",
  ROOFTOP: "rooftop",
  COMMON_AREA: "commonArea",
  STORAGE: "storage",
  OTHER: "other",
};

export function enumStatusKey(value: string) {
  return {
    OPEN: "open",
    IN_PROGRESS: "inProgress",
    COMPLETED: "completed",
    TODO: "todo",
    HIGH: "high",
    URGENT: "urgent",
    MEDIUM: "medium",
    LOW: "low",
    ACTIVE: "active",
    RETIRED: "retired",
    DISPOSED: "disposed",
    ONLINE: "online",
    OFFLINE: "offline",
    UNKNOWN: "unknown",
  }[value] as
    | "open"
    | "inProgress"
    | "completed"
    | "todo"
    | "high"
    | "urgent"
    | "medium"
    | "low"
    | "active"
    | "retired"
    | "disposed"
    | "online"
    | "offline"
    | "unknown"
    | undefined;
}
