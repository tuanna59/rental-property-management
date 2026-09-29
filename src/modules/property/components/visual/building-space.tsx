"use client";

import { useLocale, useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Box,
  Gauge,
  Users,
  WifiOff,
  Wrench,
} from "lucide-react";

import type { AppLocale } from "@/i18n/config";
import { formatCompactDateLocale } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type {
  BuildingTimeOfDay,
  BuildingVisualMode,
  BuildingVisualSpaceProjection,
} from "../../domain/types";
import { SPACE_TYPE_KEYS } from "./building-copy";
import { SpaceInterior } from "./interiors/space-interior";
import { StatusMarker } from "./indicators/status-marker";
import { getRoomVisualVariant, type RoomSizeClass } from "./layout";

export function BuildingSpace({
  space,
  mode,
  timeOfDay,
  selected,
  dimmed,
  roomSize,
  onSelect,
}: {
  space: BuildingVisualSpaceProjection;
  mode: BuildingVisualMode;
  timeOfDay: BuildingTimeOfDay;
  selected: boolean;
  dimmed?: boolean;
  roomSize: RoomSizeClass;
  onSelect: (spaceId: string, target: HTMLButtonElement) => void;
}) {
  const t = useTranslations("building");
  const locale = useLocale() as AppLocale;
  const variant = getRoomVisualVariant(space);
  const room = space.type === "ROOM";
  const rooftop = space.type === "ROOFTOP";
  const occupancyLabel =
    space.occupancyState === "OCCUPIED"
      ? t("spaceState.residents", { count: space.occupancy?.occupantCount ?? 0 })
      : space.occupancyState === "UPCOMING"
        ? space.upcomingOccupancy?.moveInDate
          ? t("spaceState.moveIn", { date: formatCompactDateLocale(space.upcomingOccupancy.moveInDate, locale) })
          : t("spaceState.moveInScheduled")
        : space.occupancyState === "VACANT"
          ? t("spaceState.vacant")
          : t("spaceState.activeSpace");

  const accessibleOverlayLabel = (() => {
    if (mode === "MAINTENANCE") {
      const total = space.maintenance.openCount + space.maintenance.inProgressCount;
      return total
        ? t("spaceState.activeMaintenanceIssues", { count: total })
        : t("spaceState.noActiveMaintenance");
    }
    if (mode === "UTILITIES") {
      if (!space.utilities.hasElectricityMeter) return t("spaceState.noElectricityMeterLower");
      if (space.utilities.missingBoundary) return t("spaceState.utilityBoundaryMissingLower");
      if (space.utilities.needsClosing) return t("spaceState.monthlyClosingRequiredLower");
      return t("spaceState.utilitiesReady");
    }
    if (mode === "ASSETS") {
      return t("spaceState.assetsDevicesAccessible", {
        assets: space.assets.activeCount,
        devices: space.devices.totalCount,
      });
    }
    if (space.occupancyState === "OCCUPIED") {
      return t("spaceState.residents", { count: space.occupancy?.occupantCount ?? 0 });
    }
    if (space.occupancyState === "UPCOMING") return t("spaceState.upcoming");
    if (space.occupancyState === "VACANT") return t("spaceState.vacant");
    return t("spaceState.activeSpace");
  })();

  return (
    <motion.button
      type="button"
      className={cn(
        "building-v2-space",
        selected && "is-selected",
        dimmed && "is-dimmed",
        `is-${space.occupancyState.toLowerCase()}`,
        `type-${space.type.toLowerCase().replaceAll("_", "-")}`,
        room && `room-size-${roomSize}`,
      )}
      data-time={timeOfDay.toLowerCase()}
      data-room-size={room ? roomSize : undefined}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      aria-label={`${space.name}, ${accessibleOverlayLabel}`}
      aria-pressed={selected}
      onClick={(event) => onSelect(space.id, event.currentTarget)}
      data-space-id={space.id}
    >
      {!rooftop && (
        <span className="building-v2-room-shell" aria-hidden="true">
          <span className="building-v2-room-ceiling" />
          <span className="building-v2-room-side" />
          <span className="building-v2-room-depth" />
        </span>
      )}
      <SpaceInterior space={space} variant={variant} roomSize={roomSize} />
      <span className="building-v2-space-label">
        <strong>{space.name}</strong>
        <small>{room ? occupancyLabel : t(`shortTypes.${SPACE_TYPE_KEYS[space.type]}`)}</small>
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
  const t = useTranslations("building");

  if (mode === "OCCUPANCY") {
    if (space.type !== "ROOM") return null;
    if (space.occupancyState === "OCCUPIED") {
      return (
        <StatusMarker
          icon={Users}
          count={space.occupancy?.occupantCount ?? 0}
          label={t("spaceState.currentResidents", { count: space.occupancy?.occupantCount ?? 0 })}
          tone="success"
        />
      );
    }
    if (space.occupancyState === "UPCOMING") {
      return <StatusMarker icon={Users} label={t("spaceState.upcomingOccupancy")} tone="info" />;
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
        label={t("overlay.activeMaintenanceIssues", { count: active })}
        tone={space.maintenance.urgentCount ? "danger" : "warning"}
      />
    );
  }

  if (mode === "UTILITIES") {
    if (!space.utilities.hasElectricityMeter) {
      return space.type === "ROOM"
        ? <StatusMarker icon={Gauge} label={t("overlay.noElectricityMeter")} tone="neutral" />
        : null;
    }
    if (space.utilities.missingBoundary || space.utilities.needsClosing) {
      return (
        <StatusMarker
          icon={AlertTriangle}
          count={space.utilities.attentionCount || undefined}
          label={space.utilities.missingBoundary ? t("overlay.boundaryAttention") : t("overlay.monthlyClosingRequired")}
          tone="warning"
        />
      );
    }
    return <StatusMarker icon={Gauge} label={t("overlay.meterReady")} tone="success" />;
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
          label={t("overlay.activeAssets", { count: space.assets.activeCount })}
          tone={assetAttention ? "warning" : "success"}
        />
      )}
      {offline > 0 && (
        <StatusMarker
          icon={WifiOff}
          count={offline}
          label={t("overlay.offlineDevices", { count: offline })}
          tone="danger"
        />
      )}
    </span>
  );
}
