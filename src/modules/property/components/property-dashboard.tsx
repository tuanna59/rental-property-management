"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import {
  Building2,
  ChevronDown,
  MapPin,
  Pencil,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  type BuildingTimeOfDay,
  type BuildingVisualFloorProjection,
  type BuildingVisualMode,
  type BuildingVisualProjection,
  type DashboardFloor,
  type DashboardPersonOption,
} from "../domain/types";
import { BuildingToolbar } from "./visual/building-toolbar";
import { BuildingVisual } from "./visual/building-visual";
import { getSpaceVisualWeight } from "./visual/layout";
import {
  FloorFormDialog,
  SpaceFormDialog,
} from "./property-forms";
import {
  SpaceInspector,
  type BuildingInspectorData,
  type SpaceInspectorTab,
} from "./space-inspector";
import "./building.css";

export function PropertyDashboard({
  property,
  people,
  inspectorData,
  initialSpaceId = null,
}: {
  property: BuildingVisualProjection;
  people: DashboardPersonOption[];
  inspectorData: BuildingInspectorData;
  initialSpaceId?: string | null;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSpaceId);
  const [mode, setMode] = React.useState<BuildingVisualMode>("OCCUPANCY");
  const [timeOfDay, setTimeOfDay] = React.useState<BuildingTimeOfDay>("DAY");
  const [focusedFloorId, setFocusedFloorId] = React.useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = React.useState<SpaceInspectorTab>("OVERVIEW");
  const [editing, setEditing] = React.useState(false);
  const lastSelected = React.useRef<HTMLButtonElement | null>(null);
  const floors = React.useMemo(() => orderVisualFloors(property.floors), [property.floors]);
  const spaces = floors.flatMap((floor) => floor.spaces);
  const floor = floors.find((item) => item.spaces.some((space) => space.id === selectedId));
  const space = floor?.spaces.find((item) => item.id === selectedId);
  const selected = floor && space ? { floor, space } : null;
  const inspectorSide = selected ? resolveInspectorSide(selected.floor, selected.space.id) : "right";

  React.useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedId(params.get("space"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const syncSpaceQuery = React.useCallback((spaceId: string | null) => {
    const url = new URL(window.location.href);
    if (spaceId) url.searchParams.set("space", spaceId);
    else url.searchParams.delete("space");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const changeFocusedFloor = React.useCallback((floorId: string | null) => {
    setFocusedFloorId(floorId);
    if (!floorId || floors.length < 7) return;
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-floor-id="${floorId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [floors.length]);

  const close = () => {
    setSelectedId(null);
    syncSpaceQuery(null);
    requestAnimationFrame(() => lastSelected.current?.focus());
  };

  const select = (id: string, target: HTMLButtonElement) => {
    lastSelected.current = target;
    setSelectedId(id);
    syncSpaceQuery(id);
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="property-workspace building-v2-page">
        <header className="property-header building-v2-page-header">
          <div className="property-heading building-v2-heading">
            <div className="building-v2-heading-title">
              <h1>{property.name}</h1>
              <span>Digital twin</span>
            </div>
            <div className="building-v2-header-meta">
              <MapPin aria-hidden="true" />
              <span>
                {[property.addressLine1, property.city, property.country]
                  .filter(Boolean)
                  .join(", ") || property.description}
              </span>
              <i />
              <span>{floors.length} floors</span>
              <i />
              <span>{spaces.length} spaces</span>
              <i />
              <span>{spaces.filter((item) => item.type === "ROOM").length} rooms</span>
            </div>
          </div>
          <div className="property-controls building-v2-header-actions">
            <Button
              size="sm"
              variant={editing ? "secondary" : "outline"}
              aria-pressed={editing}
              onClick={() => setEditing(!editing)}
            >
              <Pencil />
              {editing ? "Done" : "Edit"}
            </Button>
            <AddMenu propertyId={property.id} floors={floors} />
          </div>
        </header>

        <div className="building-v2-control-row">
          <BuildingToolbar
            floors={floors}
            mode={mode}
            timeOfDay={timeOfDay}
            focusedFloorId={focusedFloorId}
            onModeChange={setMode}
            onTimeOfDayChange={setTimeOfDay}
            onFloorChange={changeFocusedFloor}
          />
        </div>

        <div className="property-scene building-v2-workspace">
          <div className="building-v2-stage">
            <section aria-label="Interactive architectural building cutaway" className="canvas-region building-v2-canvas-region">
              <BuildingVisual
                projection={property}
                mode={mode}
                timeOfDay={timeOfDay}
                focusedFloorId={focusedFloorId}
                selectedSpaceId={selectedId}
                editing={editing}
                onSelectSpace={select}
              />
              <VisualLegend mode={mode} />
            </section>

            <AnimatePresence initial={false}>
              {selected && (
                <SpaceInspector
                  key="space-inspector"
                  propertyId={property.id}
                  floor={selected.floor}
                  space={selected.space}
                  people={people}
                  data={inspectorData}
                  tab={inspectorTab}
                  side={inspectorSide}
                  onTabChange={setInspectorTab}
                  onClose={close}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}

function VisualLegend({ mode }: { mode: BuildingVisualMode }) {
  const copy = {
    OCCUPANCY: "Occupancy state is summarized directly on rental rooms.",
    MAINTENANCE: "Active maintenance attention is summarized by space.",
    UTILITIES: "Meter and utility attention is summarized by space.",
    ASSETS: "Asset counts and device warnings are summarized by space.",
  }[mode];
  return (
    <footer className="building-v2-legend">
      <span>{copy}</span>
      <small>Click a space for full details.</small>
    </footer>
  );
}

function resolveInspectorSide(floor: BuildingVisualFloorProjection, spaceId: string): "left" | "right" {
  const spaces = [...floor.spaces].sort((a, b) => a.sortOrder - b.sortOrder);
  const totalWeight = Math.max(
    1,
    spaces.reduce((sum, space) => sum + getSpaceVisualWeight(space.type), 0),
  );
  let consumedWeight = 0;

  for (const space of spaces) {
    const weight = getSpaceVisualWeight(space.type);
    if (space.id === spaceId) {
      const normalizedCenter = (consumedWeight + weight / 2) / totalWeight;
      return normalizedCenter < 0.5 ? "right" : "left";
    }
    consumedWeight += weight;
  }

  return "right";
}

function orderVisualFloors(floors: BuildingVisualFloorProjection[]) {
  return [...floors].sort((a, b) => {
    const aRoof = a.spaces.length > 0 && a.spaces.every((space) => space.type === "ROOFTOP");
    const bRoof = b.spaces.length > 0 && b.spaces.every((space) => space.type === "ROOFTOP");
    if (aRoof !== bRoof) return aRoof ? -1 : 1;
    return (b.level ?? b.sortOrder) - (a.level ?? a.sortOrder);
  });
}

function AddMenu({
  propertyId,
  floors,
}: {
  propertyId: string;
  floors: DashboardFloor[];
}) {
  return (
    <details className="add-menu">
      <summary>
        <Plus />
        Add
        <ChevronDown className="add-menu-chevron" />
      </summary>
      <div className="add-menu-content">
        <p>Add to building</p>
        <FloorFormDialog
          mode="create"
          propertyId={propertyId}
          trigger={
            <button type="button" className="add-menu-item">
              <Building2 />
              Floor
            </button>
          }
        />
        {floors.length > 0 && (
          <>
            <div className="add-menu-separator" />
            <p>Space on floor</p>
            {floors.map((floor) => (
              <SpaceFormDialog
                key={floor.id}
                mode="create"
                floor={floor}
                trigger={
                  <button type="button" className="add-menu-item">
                    <Plus />
                    {floor.name}
                  </button>
                }
              />
            ))}
          </>
        )}
      </div>
    </details>
  );
}
