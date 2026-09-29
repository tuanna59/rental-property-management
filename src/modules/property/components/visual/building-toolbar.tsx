"use client";

import {
  Box,
  Gauge,
  Users,
  Wrench,
} from "lucide-react";
import type {
  BuildingVisualFloorProjection,
  BuildingVisualMode,
} from "../../domain/types";

const modes: Array<{ value: BuildingVisualMode; label: string; icon: typeof Users }> = [
  { value: "OCCUPANCY", label: "Occupancy", icon: Users },
  { value: "MAINTENANCE", label: "Maintenance", icon: Wrench },
  { value: "UTILITIES", label: "Utilities", icon: Gauge },
  { value: "ASSETS", label: "Assets", icon: Box },
];

export function BuildingToolbar({
  floors,
  mode,
  focusedFloorId,
  onModeChange,
  onFloorChange,
}: {
  floors: BuildingVisualFloorProjection[];
  mode: BuildingVisualMode;
  focusedFloorId: string | null;
  onModeChange: (mode: BuildingVisualMode) => void;
  onFloorChange: (floorId: string | null) => void;
}) {
  const ordered = [...floors].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return (
    <div className="building-v2-toolbar" aria-label="Building visual controls">
      <div className="building-v2-mode-tabs" role="group" aria-label="Building mode">
        {modes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={mode === value ? "is-active" : ""}
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <label className="building-v2-floor-select">
        <span>Floor</span>
        <select
          value={focusedFloorId ?? "all"}
          onChange={(event) => onFloorChange(event.target.value === "all" ? null : event.target.value)}
        >
          <option value="all">All floors</option>
          {ordered.map((floor) => (
            <option key={floor.id} value={floor.id}>{floor.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
