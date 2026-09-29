"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  Box,
  Gauge,
  Users,
  Wrench,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactDate } from "@/lib/presentation";
import type {
  BuildingVisualMode,
  BuildingVisualSpaceProjection,
} from "../../domain/types";
import { SpaceInterior } from "./interiors/space-interior";
import { StatusMarker } from "./indicators/status-marker";

export function BuildingSpace({
  space,
  mode,
  selected,
  dimmed,
  onSelect,
}: {
  space: BuildingVisualSpaceProjection;
  mode: BuildingVisualMode;
  selected: boolean;
  dimmed?: boolean;
  onSelect: (spaceId: string, target: HTMLButtonElement) => void;
}) {
  const variant = stableVariant(space.id);
  const room = space.type === "ROOM";
  const occupancyLabel =
    space.occupancyState === "OCCUPIED"
      ? `${space.occupancy?.occupantCount ?? 0} resident${space.occupancy?.occupantCount === 1 ? "" : "s"}`
      : space.occupancyState === "UPCOMING"
        ? `Move-in ${space.upcomingOccupancy?.moveInDate ? formatCompactDate(space.upcomingOccupancy.moveInDate) : "scheduled"}`
        : space.occupancyState === "VACANT"
          ? "Vacant"
          : "Active space";

  return (
    <motion.button
      type="button"
      layout="position"
      className={cn(
        "building-v2-space",
        selected && "is-selected",
        dimmed && "is-dimmed",
        `is-${space.occupancyState.toLowerCase()}`,
        `type-${space.type.toLowerCase().replaceAll("_", "-")}`,
      )}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      aria-label={`${space.name}, ${overlayAccessibleLabel(space, mode)}`}
      aria-pressed={selected}
      onClick={(event) => onSelect(space.id, event.currentTarget)}
      data-space-id={space.id}
    >
      <span className="building-v2-room-shell" aria-hidden="true">
        <span className="building-v2-room-ceiling" />
        <span className="building-v2-room-side" />
        <span className="building-v2-room-depth" />
      </span>
      <SpaceInterior space={space} variant={variant} />
      <span className="building-v2-space-label">
        <strong>{space.name}</strong>
        <small>{room ? occupancyLabel : shortType(space.type)}</small>
      </span>
      <span className="building-v2-overlay" aria-hidden="true">
        <ModeOverlay space={space} mode={mode} />
      </span>
    </motion.button>
  );
}

function ModeOverlay({
  space,
  mode,
}: {
  space: BuildingVisualSpaceProjection;
  mode: BuildingVisualMode;
}) {
  if (mode === "OCCUPANCY") {
    if (space.type !== "ROOM") return null;
    if (space.occupancyState === "OCCUPIED") {
      return (
        <StatusMarker
          icon={Users}
          count={space.occupancy?.occupantCount ?? 0}
          label={`${space.occupancy?.occupantCount ?? 0} current residents`}
          tone="success"
        />
      );
    }
    if (space.occupancyState === "UPCOMING") {
      return <StatusMarker icon={Users} label="Upcoming occupancy" tone="info" />;
    }
    return null;
  }

  if (mode === "MAINTENANCE") {
    const active = space.maintenance.openCount + space.maintenance.inProgressCount;
    if (!active) return null;
    return (
      <StatusMarker
        icon={space.maintenance.urgentCount ? AlertTriangle : Wrench}
        count={active}
        label={`${active} active maintenance issue${active === 1 ? "" : "s"}`}
        tone={space.maintenance.urgentCount ? "danger" : "warning"}
      />
    );
  }

  if (mode === "UTILITIES") {
    if (!space.utilities.hasElectricityMeter) {
      return space.type === "ROOM"
        ? <StatusMarker icon={Gauge} label="No electricity meter" tone="neutral" />
        : null;
    }
    if (space.utilities.missingBoundary || space.utilities.needsClosing) {
      return (
        <StatusMarker
          icon={AlertTriangle}
          count={space.utilities.attentionCount || undefined}
          label={
            space.utilities.missingBoundary
              ? "Utility boundary attention required"
              : "Monthly closing required"
          }
          tone="warning"
        />
      );
    }
    return <StatusMarker icon={Gauge} label="Electricity meter ready" tone="success" />;
  }

  const assetAttention = space.assets.underMaintenanceCount;
  const offline = space.devices.offlineCount;
  if (!space.assets.activeCount && !space.devices.totalCount) return null;
  return (
    <span className="building-v2-marker-group">
      {space.assets.activeCount > 0 && (
        <StatusMarker
          icon={Box}
          count={space.assets.activeCount}
          label={`${space.assets.activeCount} active asset${space.assets.activeCount === 1 ? "" : "s"}`}
          tone={assetAttention ? "warning" : "success"}
        />
      )}
      {offline > 0 && (
        <StatusMarker
          icon={WifiOff}
          count={offline}
          label={`${offline} offline device${offline === 1 ? "" : "s"}`}
          tone="danger"
        />
      )}
    </span>
  );
}

function overlayAccessibleLabel(
  space: BuildingVisualSpaceProjection,
  mode: BuildingVisualMode,
) {
  if (mode === "MAINTENANCE") {
    const total = space.maintenance.openCount + space.maintenance.inProgressCount;
    return total ? `${total} active maintenance issues` : "no active maintenance";
  }
  if (mode === "UTILITIES") {
    if (!space.utilities.hasElectricityMeter) return "no electricity meter";
    if (space.utilities.missingBoundary) return "utility boundary missing";
    if (space.utilities.needsClosing) return "monthly closing required";
    return "utilities ready";
  }
  if (mode === "ASSETS") {
    return `${space.assets.activeCount} active assets, ${space.devices.totalCount} devices`;
  }
  if (space.occupancyState === "OCCUPIED") {
    return `${space.occupancy?.occupantCount ?? 0} residents`;
  }
  return space.occupancyState.toLowerCase().replaceAll("_", " ");
}

function stableVariant(id: string) {
  return (
    Array.from(id).reduce(
      (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
      0,
    ) % 3
  );
}

function shortType(type: BuildingVisualSpaceProjection["type"]) {
  return {
    ROOM: "Room",
    OWNER_HOME: "Owner home",
    GARAGE: "Garage",
    ROOFTOP: "Rooftop",
    COMMON_AREA: "Common area",
    STORAGE: "Storage",
    OTHER: "Space",
  }[type];
}
