import type { CSSProperties } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { BuildingVisualProjection } from "../../domain/types";
import { getRoomSizeClass, getRoomVisualVariant, getSpaceVisualWeight } from "./layout";
import { SpaceInterior } from "./interiors/space-interior";

export function MiniBuildingVisual({ projection }: { projection: BuildingVisualProjection }) {
  const floors = [...projection.floors].sort((a, b) => (b.level ?? b.sortOrder) - (a.level ?? a.sortOrder));

  return (
    <div className="mini-building mini-building-v2" aria-label={`${projection.name} building overview`}>
      <div className="mini-building-sky" aria-hidden="true"><span /></div>
      <div className="mini-building-landscape" aria-hidden="true"><i /><i /><i /></div>
      <div className="mini-building-stack" style={{ "--mini-floor-count": Math.max(floors.length, 1) } as CSSProperties}>
        {floors.map((floor) => (
          <div className={`mini-building-floor${floor.spaces.length === 0 ? " is-empty" : ""}`} key={floor.id}>
            <span className="mini-building-floor-label">{floor.name}</span>
            {floor.spaces.length ? (
              <div className="mini-building-spaces">
                {floor.spaces.map((space) => {
                  const attention = space.maintenance.urgentCount > 0 || space.utilities.missingBoundary || space.utilities.needsClosing || space.devices.offlineCount > 0;
                  const weight = getSpaceVisualWeight(space.type);
                  const roomSize = getRoomSizeClass({ space, floor });
                  return (
                    <Link
                      key={space.id}
                      href={`/building?space=${space.id}`}
                      className={`mini-building-space type-${space.type.toLowerCase().replaceAll("_", "-")} is-${space.occupancyState.toLowerCase()}${attention ? " has-attention" : ""}`}
                      style={{ flexGrow: weight, flexBasis: `${Math.max(16, weight * 52)}px` }}
                      aria-label={`${space.name}, ${space.occupancyState.toLowerCase().replaceAll("_", " ")}`}
                      title={spaceTooltip(space)}
                    >
                      <SpaceInterior space={space} variant={getRoomVisualVariant(space)} roomSize={roomSize} />
                      <span className="mini-building-space-shade" aria-hidden="true" />
                      <span className="mini-building-space-label">
                        <strong>{space.name}</strong>
                        <small>{space.type === "ROOM" ? occupancyText(space) : shortType(space.type)}</small>
                      </span>
                      {attention && <span className="mini-building-attention" aria-hidden="true"><AlertTriangle /></span>}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <span className="mini-building-empty-floor">No spaces</span>
            )}
          </div>
        ))}
        <div className="mini-building-foundation" aria-hidden="true" />
      </div>
    </div>
  );
}

function occupancyText(space: BuildingVisualProjection["floors"][number]["spaces"][number]) {
  if (space.occupancyState === "OCCUPIED") return `${space.occupancy?.occupantCount ?? 0} resident${space.occupancy?.occupantCount === 1 ? "" : "s"}`;
  if (space.occupancyState === "UPCOMING") return "Upcoming";
  return "Vacant";
}

function shortType(type: BuildingVisualProjection["floors"][number]["spaces"][number]["type"]) {
  return {
    ROOM: "Rental room",
    OWNER_HOME: "Owner home",
    GARAGE: "Garage",
    ROOFTOP: "Rooftop",
    COMMON_AREA: "Common area",
    STORAGE: "Storage",
    OTHER: "Space",
  }[type];
}

function spaceTooltip(space: BuildingVisualProjection["floors"][number]["spaces"][number]) {
  const messages = [space.type === "ROOM" ? occupancyText(space) : shortType(space.type)];
  const active = space.maintenance.openCount + space.maintenance.inProgressCount;
  if (active) messages.push(`${active} maintenance issue${active === 1 ? "" : "s"}`);
  if (space.utilities.missingBoundary) messages.push("Utility boundary missing");
  else if (space.utilities.needsClosing) messages.push("Monthly closing required");
  if (space.devices.offlineCount) messages.push(`${space.devices.offlineCount} device${space.devices.offlineCount === 1 ? "" : "s"} offline`);
  return messages.join(" · ");
}
