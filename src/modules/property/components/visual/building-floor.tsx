"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import type {
  BuildingTimeOfDay,
  BuildingVisualFloorProjection,
  BuildingVisualMode,
} from "../../domain/types";
import { FloorActions } from "../property-forms";
import { BuildingSpace } from "./building-space";
import { getRoomSizeClass, getSpaceVisualWeight } from "./layout";

export function BuildingFloor({
  floor,
  propertyId,
  mode,
  timeOfDay,
  selectedSpaceId,
  focused,
  muted,
  editing,
  onSelectSpace,
}: {
  floor: BuildingVisualFloorProjection;
  propertyId: string;
  mode: BuildingVisualMode;
  timeOfDay: BuildingTimeOfDay;
  selectedSpaceId: string | null;
  focused: boolean;
  muted: boolean;
  editing: boolean;
  onSelectSpace: (spaceId: string, target: HTMLButtonElement) => void;
}) {
  const t = useTranslations("building");
  const spaces = [...floor.spaces].sort((a, b) => a.sortOrder - b.sortOrder);
  const units = Math.max(
    1,
    spaces.reduce((sum, space) => sum + getSpaceVisualWeight(space.type), 0),
  );
  const rooftopFloor =
    spaces.length > 0 && spaces.every((space) => space.type === "ROOFTOP");
  const emptyFloor = spaces.length === 0;

  return (
    <motion.section
      className={`building-v2-floor${focused ? " is-focused" : ""}${muted ? " is-muted" : ""}${rooftopFloor ? " is-rooftop-floor" : ""}${emptyFloor ? " is-empty-floor" : ""}`}
      data-floor-id={floor.id}
      aria-label={floor.name}
      animate={{
        opacity: muted ? 0.2 : 1,
        scale: focused ? 1.16 : 1,
        y: focused ? -6 : 0,
      }}
      transition={{ duration: 0.26, ease: "easeOut" }}
    >
      <div className="building-v2-floor-label">
        <strong>{floor.name}</strong>
        <span>{t("counts.spaces", { count: spaces.length })}</span>
      </div>
      {editing && <FloorActions floor={floor} propertyId={propertyId} />}
      <div
        className="building-v2-floor-grid"
        style={{
          gridTemplateColumns: spaces.length
            ? spaces
                .map((space) => `${getSpaceVisualWeight(space.type)}fr`)
                .join(" ")
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
              timeOfDay={timeOfDay}
              selected={space.id === selectedSpaceId}
              dimmed={Boolean(
                selectedSpaceId && space.id !== selectedSpaceId && focused,
              )}
              roomSize={getRoomSizeClass({ space, floor })}
              onSelect={onSelectSpace}
            />
          ))
        ) : (
          <div className="building-v2-empty-floor">
            <strong>{t("scene.noSpaces")}</strong>
            <span>{t("scene.emptyFloor")}</span>
          </div>
        )}
      </div>
      <div className="building-v2-floor-slab" aria-hidden="true" />
      <div className="building-v2-floor-side" aria-hidden="true" />
    </motion.section>
  );
}
