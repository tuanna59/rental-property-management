"use client";

import { Building2 } from "lucide-react";
import type {
  BuildingTimeOfDay,
  BuildingVisualFloorProjection,
  BuildingVisualMode,
  BuildingVisualProjection,
} from "../../domain/types";
import { BuildingFloor } from "./building-floor";

export function BuildingVisual({
  projection,
  mode,
  timeOfDay,
  focusedFloorId,
  selectedSpaceId,
  editing,
  onSelectSpace,
}: {
  projection: BuildingVisualProjection;
  mode: BuildingVisualMode;
  timeOfDay: BuildingTimeOfDay;
  focusedFloorId: string | null;
  selectedSpaceId: string | null;
  editing: boolean;
  onSelectSpace: (spaceId: string, target: HTMLButtonElement) => void;
}) {
  const floors = orderFloors(projection.floors);
  const hasOpenRooftop = Boolean(
    floors[0]?.spaces.length && floors[0].spaces.every((space) => space.type === "ROOFTOP"),
  );
  const tallBuilding = floors.length >= 7;
  if (!floors.length) {
    return (
      <div className="building-v2-empty">
        <Building2 />
        <strong>No floors configured</strong>
        <span>Add a floor to start the building cutaway.</span>
      </div>
    );
  }

  return (
    <div
      className={`building-v2-scene${focusedFloorId ? " has-focus" : ""}${tallBuilding ? " is-tall-building" : ""}`}
      data-mode={mode.toLowerCase()}
      data-time={timeOfDay.toLowerCase()}
      data-floor-count={floors.length}
    >
      <div className="building-v2-sky" aria-hidden="true">
        <span className="building-v2-sun" />
        <span className="building-v2-moon" />
        <span className="building-v2-cloud cloud-a" />
        <span className="building-v2-cloud cloud-b" />
      </div>
      <div className="building-v2-neighborhood" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <div className={`building-v2-stack${hasOpenRooftop ? " has-open-rooftop" : ""}`}>
        <div className="building-v2-roof-cap" aria-hidden="true" />
        {floors.map((floor) => {
          const focused = floor.id === focusedFloorId;
          return (
            <BuildingFloor
              key={floor.id}
              floor={floor}
              propertyId={projection.id}
              mode={mode}
              timeOfDay={timeOfDay}
              selectedSpaceId={selectedSpaceId}
              focused={focused}
              muted={Boolean(focusedFloorId && !focused)}
              editing={editing}
              onSelectSpace={onSelectSpace}
            />
          );
        })}
        <div className="building-v2-foundation" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
      <div className="building-v2-landscape landscape-left" aria-hidden="true"><Tree /><Shrub /></div>
      <div className="building-v2-landscape landscape-right" aria-hidden="true"><Shrub /><Tree /></div>
      <div className="building-v2-ground" aria-hidden="true" />
    </div>
  );
}

function orderFloors(floors: BuildingVisualFloorProjection[]) {
  return [...floors].sort((a, b) => {
    const aRoof = a.spaces.length > 0 && a.spaces.every((space) => space.type === "ROOFTOP");
    const bRoof = b.spaces.length > 0 && b.spaces.every((space) => space.type === "ROOFTOP");
    if (aRoof !== bRoof) return aRoof ? -1 : 1;
    const aLevel = a.level ?? a.sortOrder;
    const bLevel = b.level ?? b.sortOrder;
    return bLevel - aLevel;
  });
}

function Tree() {
  return (
    <svg viewBox="0 0 80 130">
      <path d="M39 124V59" stroke="#705f47" strokeWidth="9" />
      <circle cx="40" cy="42" r="31" fill="var(--building-tree-dark, #688267)" />
      <circle cx="22" cy="51" r="21" fill="var(--building-tree-light, #789472)" />
      <circle cx="57" cy="55" r="22" fill="var(--building-tree-mid, #5d795f)" />
    </svg>
  );
}

function Shrub() {
  return (
    <svg viewBox="0 0 90 60">
      <circle cx="22" cy="38" r="19" fill="var(--building-tree-mid, #718a69)" />
      <circle cx="45" cy="29" r="24" fill="var(--building-tree-light, #7f9874)" />
      <circle cx="69" cy="39" r="18" fill="var(--building-tree-dark, #667e63)" />
    </svg>
  );
}
