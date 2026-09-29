"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

import type { BuildingVisualProjection } from "../../domain/types";
import { SPACE_TYPE_KEYS } from "./building-copy";
import { getRoomSizeClass, getRoomVisualVariant, getSpaceVisualWeight } from "./layout";
import { SpaceInterior } from "./interiors/space-interior";

export function MiniBuildingVisual({ projection }: { projection: BuildingVisualProjection }) {
  const t = useTranslations("building");
  const floors = [...projection.floors].sort((a, b) => (b.level ?? b.sortOrder) - (a.level ?? a.sortOrder));

  const occupancyText = (space: BuildingVisualProjection["floors"][number]["spaces"][number]) => {
    if (space.occupancyState === "OCCUPIED") return t("spaceState.residents", { count: space.occupancy?.occupantCount ?? 0 });
    if (space.occupancyState === "UPCOMING") return t("spaceState.upcoming");
    return t("spaceState.vacant");
  };

  const shortType = (space: BuildingVisualProjection["floors"][number]["spaces"][number]) =>
    t(`shortTypes.${SPACE_TYPE_KEYS[space.type]}`);

  const tooltip = (space: BuildingVisualProjection["floors"][number]["spaces"][number]) => {
    const messages = [space.type === "ROOM" ? occupancyText(space) : shortType(space)];
    const active = space.maintenance.openCount + space.maintenance.inProgressCount;
    if (active) messages.push(t("overlay.activeMaintenanceIssues", { count: active }));
    if (space.utilities.missingBoundary) messages.push(t("overlay.boundaryAttention"));
    else if (space.utilities.needsClosing) messages.push(t("overlay.monthlyClosingRequired"));
    if (space.devices.offlineCount) messages.push(t("overlay.offlineDevices", { count: space.devices.offlineCount }));
    return messages.join(" · ");
  };

  return (
    <div className="mini-building mini-building-v2" aria-label={t("scene.overviewLabel", { property: projection.name })}>
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
                      aria-label={`${space.name}, ${space.type === "ROOM" ? occupancyText(space) : shortType(space)}`}
                      title={tooltip(space)}
                    >
                      <SpaceInterior space={space} variant={getRoomVisualVariant(space)} roomSize={roomSize} />
                      <span className="mini-building-space-shade" aria-hidden="true" />
                      <span className="mini-building-space-label">
                        <strong>{space.name}</strong>
                        <small>{space.type === "ROOM" ? occupancyText(space) : shortType(space)}</small>
                      </span>
                      {attention && <span className="mini-building-attention" aria-hidden="true"><AlertTriangle /></span>}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <span className="mini-building-empty-floor">{t("scene.noSpaces")}</span>
            )}
          </div>
        ))}
        <div className="mini-building-foundation" aria-hidden="true" />
      </div>
    </div>
  );
}
