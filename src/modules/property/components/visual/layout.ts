import type {
  BuildingVisualFloorProjection,
  BuildingVisualSpaceProjection,
} from "../../domain/types";

export function orderVisualSpaces(spaces: BuildingVisualSpaceProjection[]) {
  return [...spaces].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function orderVisualFloors(floors: BuildingVisualFloorProjection[]) {
  return [...floors].sort((a, b) => {
    const aRoof = a.spaces.length > 0 && a.spaces.every((space) => space.type === "ROOFTOP");
    const bRoof = b.spaces.length > 0 && b.spaces.every((space) => space.type === "ROOFTOP");
    if (aRoof !== bRoof) return aRoof ? -1 : 1;
    return (b.level ?? b.sortOrder) - (a.level ?? a.sortOrder);
  });
}

export type RoomSizeClass = "small" | "medium" | "large" | "xl";

export function getSpaceVisualWeight(
  type: BuildingVisualSpaceProjection["type"],
) {
  return {
    ROOM: 1,
    OWNER_HOME: 1.65,
    GARAGE: 1.45,
    ROOFTOP: 1.2,
    COMMON_AREA: 1.35,
    STORAGE: 0.85,
    OTHER: 1,
  }[type];
}

export function getRoomVisualVariant(space: BuildingVisualSpaceProjection) {
  return Math.abs(space.sortOrder) % 4;
}

/**
 * Presentation-only room sizing derived from the room's share of the rendered
 * floor width. This deliberately stays out of the business/domain model.
 *
 * Wider rooms gain richer zones and slightly larger furniture; they never get
 * an inverse scale that makes furniture smaller simply because more width is
 * available.
 */
export function getRoomSizeClass({
  space,
  floor,
}: {
  space: BuildingVisualSpaceProjection;
  floor: BuildingVisualFloorProjection;
}): RoomSizeClass {
  if (space.type !== "ROOM") return "medium";

  const totalWeight = Math.max(
    1,
    floor.spaces.reduce(
      (sum, item) => sum + getSpaceVisualWeight(item.type),
      0,
    ),
  );
  const widthRatio = getSpaceVisualWeight(space.type) / totalWeight;

  if (widthRatio < 0.24) return "small";
  if (widthRatio < 0.42) return "medium";
  if (widthRatio < 0.72) return "large";
  return "xl";
}
