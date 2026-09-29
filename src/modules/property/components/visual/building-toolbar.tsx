"use client";

import { useTranslations } from "next-intl";
import {
  Box,
  Gauge,
  Moon,
  Sun,
  Users,
  Wrench,
} from "lucide-react";
import type {
  BuildingTimeOfDay,
  BuildingVisualFloorProjection,
  BuildingVisualMode,
} from "../../domain/types";

const modes: Array<{ value: BuildingVisualMode; key: "occupancy" | "maintenance" | "utilities" | "assets"; icon: typeof Users }> = [
  { value: "OCCUPANCY", key: "occupancy", icon: Users },
  { value: "MAINTENANCE", key: "maintenance", icon: Wrench },
  { value: "UTILITIES", key: "utilities", icon: Gauge },
  { value: "ASSETS", key: "assets", icon: Box },
];

export function BuildingToolbar({
  floors,
  mode,
  timeOfDay,
  focusedFloorId,
  onModeChange,
  onTimeOfDayChange,
  onFloorChange,
}: {
  floors: BuildingVisualFloorProjection[];
  mode: BuildingVisualMode;
  timeOfDay: BuildingTimeOfDay;
  focusedFloorId: string | null;
  onModeChange: (mode: BuildingVisualMode) => void;
  onTimeOfDayChange: (time: BuildingTimeOfDay) => void;
  onFloorChange: (floorId: string | null) => void;
}) {
  const t = useTranslations("building");
  const ordered = [...floors].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="building-v2-toolbar" aria-label={t("toolbar.controls")}>
      <div className="building-v2-mode-tabs" role="group" aria-label={t("toolbar.mode")}>
        {modes.map(({ value, key, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={mode === value ? "is-active" : ""}
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
          >
            <Icon aria-hidden="true" />
            <span>{t(`toolbar.${key}`)}</span>
          </button>
        ))}
      </div>

      <div className="building-v2-time-toggle" role="group" aria-label={t("toolbar.timeOfDay")}>
        <button
          type="button"
          className={timeOfDay === "DAY" ? "is-active" : ""}
          aria-pressed={timeOfDay === "DAY"}
          onClick={() => onTimeOfDayChange("DAY")}
        >
          <Sun aria-hidden="true" />
          <span>{t("toolbar.day")}</span>
        </button>
        <button
          type="button"
          className={timeOfDay === "NIGHT" ? "is-active" : ""}
          aria-pressed={timeOfDay === "NIGHT"}
          onClick={() => onTimeOfDayChange("NIGHT")}
        >
          <Moon aria-hidden="true" />
          <span>{t("toolbar.night")}</span>
        </button>
      </div>

      <label className="building-v2-floor-select">
        <span>{t("toolbar.floorSelector")}</span>
        <select
          value={focusedFloorId ?? "all"}
          onChange={(event) => onFloorChange(event.target.value === "all" ? null : event.target.value)}
        >
          <option value="all">{t("toolbar.allFloors")}</option>
          {ordered.map((floor) => (
            <option key={floor.id} value={floor.id}>{floor.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
