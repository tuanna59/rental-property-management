import Link from "next/link";
import { AlertTriangle, Wrench, WifiOff } from "lucide-react";

import type { BuildingVisualProjection } from "../../domain/types";

export function MiniBuildingVisual({ projection }: { projection: BuildingVisualProjection }) {
  const floors = [...projection.floors].sort((a, b) => (b.level ?? b.sortOrder) - (a.level ?? a.sortOrder));
  return (
    <div className="mini-building" aria-label={`${projection.name} building overview`}>
      <div className="mini-building-sky" aria-hidden="true"><span /></div>
      <div className="mini-building-stack">
        <div className="mini-building-roof" aria-hidden="true" />
        {floors.map((floor) => (
          <div className="mini-building-floor" key={floor.id}>
            <span className="mini-building-floor-label">{floor.name}</span>
            <div className="mini-building-spaces">
              {floor.spaces.map((space) => {
                const attention = space.maintenance.urgentCount > 0 || space.utilities.missingBoundary || space.utilities.needsClosing || space.devices.offlineCount > 0;
                return (
                  <Link
                    key={space.id}
                    href={`/building?space=${space.id}`}
                    className={`mini-building-space is-${space.occupancyState.toLowerCase()}${attention ? " has-attention" : ""}`}
                    aria-label={`${space.name}, ${space.occupancyState.toLowerCase().replaceAll("_", " ")}`}
                    title={spaceTooltip(space)}
                  >
                    <span className="mini-building-space-back" aria-hidden="true" />
                    <strong>{space.name}</strong>
                    {space.type === "ROOM" && <small>{occupancyText(space)}</small>}
                    <span className="mini-building-attention" aria-hidden="true">
                      {space.maintenance.urgentCount > 0 ? <AlertTriangle /> : space.maintenance.openCount + space.maintenance.inProgressCount > 0 ? <Wrench /> : space.devices.offlineCount > 0 ? <WifiOff /> : space.utilities.missingBoundary || space.utilities.needsClosing ? <AlertTriangle /> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mini-building-foundation" aria-hidden="true" />
      </div>
    </div>
  );
}

function occupancyText(space: BuildingVisualProjection["floors"][number]["spaces"][number]) {
  if (space.occupancyState === "OCCUPIED") return `${space.occupancy?.occupantCount ?? 0} residents`;
  if (space.occupancyState === "UPCOMING") return "Upcoming";
  return "Vacant";
}

function spaceTooltip(space: BuildingVisualProjection["floors"][number]["spaces"][number]) {
  const messages = [space.type === "ROOM" ? occupancyText(space) : space.type.toLowerCase().replaceAll("_", " ")];
  const active = space.maintenance.openCount + space.maintenance.inProgressCount;
  if (active) messages.push(`${active} maintenance issue${active === 1 ? "" : "s"}`);
  if (space.utilities.missingBoundary) messages.push("Utility boundary missing");
  else if (space.utilities.needsClosing) messages.push("Monthly closing required");
  if (space.devices.offlineCount) messages.push(`${space.devices.offlineCount} device${space.devices.offlineCount === 1 ? "" : "s"} offline`);
  return messages.join(" · ");
}
