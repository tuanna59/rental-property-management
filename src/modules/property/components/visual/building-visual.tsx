"use client";

import { Building2 } from "lucide-react";
import type {
  BuildingVisualFloorProjection,
  BuildingVisualMode,
  BuildingVisualProjection,
} from "../../domain/types";
import { BuildingFloor } from "./building-floor";

export function BuildingVisual({
  projection,
  mode,
  focusedFloorId,
  selectedSpaceId,
  editing,
  onSelectSpace,
}: {
  projection: BuildingVisualProjection;
  mode: BuildingVisualMode;
  focusedFloorId: string | null;
  selectedSpaceId: string | null;
  editing: boolean;
  onSelectSpace: (spaceId: string, target: HTMLButtonElement) => void;
}) {
  const floors = orderFloors(projection.floors);
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
      className={`building-v2-scene${focusedFloorId ? " has-focus" : ""}`}
      data-mode={mode.toLowerCase()}
    >
      <div className="building-v2-sky" aria-hidden="true">
        <span className="building-v2-sun" />
        <span className="building-v2-cloud cloud-a" />
        <span className="building-v2-cloud cloud-b" />
      </div>
      <div className="building-v2-neighborhood" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <div className="building-v2-stack">
        <div className="building-v2-roof-cap" aria-hidden="true" />
        {floors.map((floor) => {
          const focused = floor.id === focusedFloorId;
          return (
            <BuildingFloor
              key={floor.id}
              floor={floor}
              propertyId={projection.id}
              mode={mode}
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
      <circle cx="40" cy="42" r="31" fill="#688267" />
      <circle cx="22" cy="51" r="21" fill="#789472" />
      <circle cx="57" cy="55" r="22" fill="#5d795f" />
    </svg>
  );
}
function Shrub() {
  return (
    <svg viewBox="0 0 90 60">
      <circle cx="22" cy="38" r="19" fill="#718a69" />
      <circle cx="45" cy="29" r="24" fill="#7f9874" />
      <circle cx="69" cy="39" r="18" fill="#667e63" />
    </svg>
  );
}
