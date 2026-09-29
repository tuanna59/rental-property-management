"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";
import type {
  BuildingVisualFloorProjection,
  BuildingVisualMode,
} from "../../domain/types";
import { BuildingSpace } from "./building-space";
import { FloorActions } from "../property-forms";

export function BuildingFloor({
  floor,
  propertyId,
  mode,
  selectedSpaceId,
  focused,
  muted,
  editing,
  onSelectSpace,
}: {
  floor: BuildingVisualFloorProjection;
  propertyId: string;
  mode: BuildingVisualMode;
  selectedSpaceId: string | null;
  focused: boolean;
  muted: boolean;
  editing: boolean;
  onSelectSpace: (spaceId: string, target: HTMLButtonElement) => void;
}) {
  const spaces = [...floor.spaces].sort((a, b) => a.sortOrder - b.sortOrder);
  const units = Math.max(
    1,
    spaces.reduce((sum, space) => sum + spaceWeight(space.type), 0),
  );
  return (
    <motion.section
      layout
      className={`building-v2-floor${focused ? " is-focused" : ""}${muted ? " is-muted" : ""}`}
      data-floor-id={floor.id}
      aria-label={floor.name}
      animate={{ opacity: muted ? 0.32 : 1, scale: focused ? 1.018 : 1 }}
      transition={{ duration: 0.24 }}
    >
      <div className="building-v2-floor-label">
        <strong>{floor.name}</strong>
        <span>{spaces.length} {spaces.length === 1 ? "space" : "spaces"}</span>
      </div>
      {editing && <FloorActions floor={floor} propertyId={propertyId} />}
      <div
        className="building-v2-floor-grid"
        style={{
          gridTemplateColumns: spaces.length
            ? spaces.map((space) => `${spaceWeight(space.type)}fr`).join(" ")
            : undefined,
          "--floor-units": units,
        } as CSSProperties}
      >
        {spaces.length ? (
          spaces.map((space) => (
            <BuildingSpace
              key={space.id}
              space={space}
              mode={mode}
              selected={space.id === selectedSpaceId}
              dimmed={Boolean(selectedSpaceId && space.id !== selectedSpaceId && focused)}
              onSelect={onSelectSpace}
            />
          ))
        ) : (
          <div className="building-v2-empty-floor">No spaces on this floor</div>
        )}
      </div>
      <div className="building-v2-floor-slab" aria-hidden="true" />
      <div className="building-v2-floor-side" aria-hidden="true" />
    </motion.section>
  );
}

function spaceWeight(type: BuildingVisualFloorProjection["spaces"][number]["type"]) {
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
