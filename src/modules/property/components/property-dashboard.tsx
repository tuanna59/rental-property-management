"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";
import {
  Building2,
  ChevronDown,
  Pencil,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  LogOut,
  Wrench,
  Boxes,
  Gauge,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatVnd } from "@/lib/presentation";
import { archiveSpaceAction, deleteSpaceAction } from "../actions";
import {
  SPACE_TYPE_LABELS,
  type BuildingVisualMode,
  type BuildingVisualProjection,
  type BuildingVisualFloorProjection,
  type BuildingVisualSpaceProjection,
  type DashboardFloor,
  type DashboardPersonOption,
} from "../domain/types";
import {
  AddOccupantDialog,
  CancelScheduledMoveOutButton,
  CancelUpcomingMoveInButton,
  EndOccupancyDialog,
  MoveInDialog,
  MoveOutDialog,
} from "@/modules/tenancy/components/tenancy-dialogs";
import { BuildingVisual } from "./visual/building-visual";
import { BuildingToolbar } from "./visual/building-toolbar";
import {
  FloorFormDialog,
  SpaceFormDialog,
  SpaceReorderButton,
  ArchiveOrDeleteDialog,
} from "./property-forms";
import "./building.css";

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 1100px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const desktopSnapshot = () => window.matchMedia("(min-width: 1100px)").matches;

export function PropertyDashboard({
  property,
  people,
  initialSpaceId = null,
}: {
  property: BuildingVisualProjection;
  people: DashboardPersonOption[];
  initialSpaceId?: string | null;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSpaceId);
  const [mode, setMode] = React.useState<BuildingVisualMode>("OCCUPANCY");
  const [focusedFloorId, setFocusedFloorId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const desktop = React.useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    () => false,
  );
  const lastSelected = React.useRef<HTMLButtonElement | null>(null);
  const floors = React.useMemo(() => orderVisualFloors(property.floors), [property.floors]);
  const spaces = floors.flatMap((floor) => floor.spaces);
  const floor = floors.find((item) =>
    item.spaces.some((space) => space.id === selectedId),
  );
  const space = floor?.spaces.find((item) => item.id === selectedId);
  const selected = floor && space ? { floor, space } : null;

  React.useEffect(() => {
    if (initialSpaceId) {
      const initialFloor = floors.find((item) => item.spaces.some((space) => space.id === initialSpaceId));
      if (initialFloor) setFocusedFloorId(initialFloor.id);
    }
  }, [floors, initialSpaceId]);

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

  const close = () => {
    setSelectedId(null);
    syncSpaceQuery(null);
    requestAnimationFrame(() => lastSelected.current?.focus());
  };
  const select = (id: string, target: HTMLButtonElement) => {
    lastSelected.current = target;
    setSelectedId(id);
    syncSpaceQuery(id);
    const selectedFloor = floors.find((item) => item.spaces.some((item) => item.id === id));
    if (!desktop && selectedFloor) setFocusedFloorId(selectedFloor.id);
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="property-workspace building-v2-page">
        <header className="property-header">
          <div className="property-heading">
            <p className="property-eyebrow">BUILDING DIGITAL TWIN</p>
            <h1>{property.name}</h1>
            <p>
              {[property.addressLine1, property.city, property.country]
                .filter(Boolean)
                .join(", ") || property.description}
            </p>
          </div>
          <div className="property-controls">
            <Button
              variant={editing ? "secondary" : "outline"}
              aria-pressed={editing}
              onClick={() => setEditing(!editing)}
            >
              <Pencil />
              {editing ? "Done editing" : "Edit building"}
            </Button>
            <AddMenu propertyId={property.id} floors={floors} />
          </div>
        </header>

        <div className="building-v2-control-row">
          <div className="building-v2-caption">
            <Building2 aria-hidden="true" />
            <span>{floors.length} floors</span>
            <i />
            <span>{spaces.length} spaces</span>
            <i />
            <span>{spaces.filter((item) => item.type === "ROOM").length} rental rooms</span>
          </div>
          <BuildingToolbar
            floors={floors}
            mode={mode}
            focusedFloorId={focusedFloorId}
            onModeChange={setMode}
            onFloorChange={(floorId) => {
              setFocusedFloorId(floorId);
              if (floorId && selected && selected.floor.id !== floorId) {
                setSelectedId(null);
                syncSpaceQuery(null);
              }
            }}
          />
        </div>

        <div className={`property-scene building-v2-workspace${selected ? " has-selection" : ""}`}>
          <section aria-label="Interactive architectural building cutaway" className="canvas-region building-v2-canvas-region">
            <BuildingVisual
              projection={property}
              mode={mode}
              focusedFloorId={focusedFloorId}
              selectedSpaceId={selectedId}
              editing={editing}
              onSelectSpace={select}
            />
            <VisualLegend mode={mode} />
          </section>
          {desktop && (
            <aside className="context-panel building-v2-context-panel" aria-label="Space details">
              {selected ? (
                <>
                  <button className="panel-close" onClick={close} aria-label="Close detail panel" title="Close detail panel">
                    <X size={18} />
                  </button>
                  <SpaceDetails key={selected.space.id} {...selected} people={people} />
                </>
              ) : (
                <div className="panel-empty building-v2-panel-empty">
                  <Building2 size={34} />
                  <h2>Explore the building</h2>
                  <p>Select a space to open its operational overview.</p>
                  <div className="building-v2-panel-tips">
                    <span><Users /> Occupancy</span>
                    <span><Wrench /> Maintenance</span>
                    <span><Gauge /> Utilities</span>
                    <span><Boxes /> Assets</span>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>

        {!desktop && selected && (
          <div className="mobile-space-layer">
            <button type="button" className="mobile-space-backdrop" aria-label="Close space details" onClick={close} />
            <section className="space-sheet" role="dialog" aria-modal="true" aria-label={`${selected.space.name} details`}>
              <button type="button" className="panel-close" onClick={close} aria-label="Close space details"><X /></button>
              <SpaceDetails key={selected.space.id} {...selected} people={people} />
            </section>
          </div>
        )}
      </main>
    </MotionConfig>
  );
}

function VisualLegend({ mode }: { mode: BuildingVisualMode }) {
  const copy = {
    OCCUPANCY: "Room accents show occupied, upcoming, and vacant rental spaces.",
    MAINTENANCE: "Markers show active issues only; urgent issues receive warning emphasis.",
    UTILITIES: "Meter readiness, missing boundaries, and closing attention are highlighted.",
    ASSETS: "Asset counts and offline-device warnings are summarized by space.",
  }[mode];
  return <footer className="building-v2-legend"><span>{copy}</span><small>Click any space for full details</small></footer>;
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

function SpaceDetails({
  floor,
  space,
  people,
}: {
  floor: DashboardFloor;
  space: BuildingVisualSpaceProjection;
  people: DashboardPersonOption[];
}) {
  const isRoom = space.type === "ROOM";
  const occupied = Boolean(space.occupancy);
  return (
    <div className="space-details">
      <p className="eyebrow">SPACE OVERVIEW</p>
      <h2>{space.name}</h2>
      <p className="space-type">{SPACE_TYPE_LABELS[space.type]}</p>
      {isRoom ? (
        <div
          className={`active-status ${occupied ? "status-occupied" : "status-available"}`}
        >
          <span>
            <i />
            {occupied ? "Occupied" : "Available"}
          </span>
          <small>
            {occupied
              ? `${space.occupancy?.occupantCount} ${space.occupancy?.occupantCount === 1 ? "person" : "people"} living here`
              : space.upcomingOccupancy
                ? "No current tenant"
                : "No current or upcoming tenant"}
          </small>
        </div>
      ) : (
        <div className="active-status non-rental-status">Active space</div>
      )}
      {(space.utilities.hasElectricityMeter || space.utilities.attentionCount > 0) && (
        <section className="space-utility-signal">
          <div>
            <span className="space-maintenance-icon"><Gauge aria-hidden="true" /></span>
            <div>
              <strong>Utilities</strong>
              <p>
                {space.utilities.hasElectricityMeter ? `${space.utilities.meterCount || 1} electricity meter${(space.utilities.meterCount || 1) === 1 ? "" : "s"}` : "No electricity meter"}
                {space.utilities.needsClosing ? " · closing required" : ""}
                {space.utilities.missingBoundary ? " · boundary attention" : ""}
              </p>
            </div>
          </div>
          <a href={`/utilities/meters?space=${space.id}`}>View meters</a>
        </section>
      )}
      {space.maintenance.openCount + space.maintenance.inProgressCount > 0 && (
        <section className="space-maintenance-signal">
          <div>
            <span className="space-maintenance-icon"><Wrench aria-hidden="true" /></span>
            <div>
              <strong>Maintenance</strong>
              <p>
                {space.maintenance.openCount + space.maintenance.inProgressCount} active issue{space.maintenance.openCount + space.maintenance.inProgressCount === 1 ? "" : "s"}
                {space.maintenance.urgentCount > 0
                  ? ` · ${space.maintenance.urgentCount} urgent`
                  : ""}
              </p>
            </div>
          </div>
          <a href={`/operations/maintenance?space=${space.id}`}>View maintenance</a>
        </section>
      )}
      {(space.assets.activeCount > 0 || space.devices.totalCount > 0) && (
        <section className="space-asset-signal">
          <div>
            <span className="space-maintenance-icon"><Boxes aria-hidden="true" /></span>
            <div>
              <strong>Assets & Devices</strong>
              <p>
                {space.assets.activeCount} active asset{space.assets.activeCount === 1 ? "" : "s"}
                {space.assets.underMaintenanceCount > 0 ? ` · ${space.assets.underMaintenanceCount} under maintenance` : ""}
                {space.devices.totalCount > 0 ? ` · ${space.devices.totalCount} device${space.devices.totalCount === 1 ? "" : "s"}` : ""}
                {space.devices.offlineCount > 0 ? ` · ${space.devices.offlineCount} offline` : ""}
              </p>
            </div>
          </div>
          <a href={`/assets?location=${space.id}`}>View assets</a>
        </section>
      )}
      {isRoom && space.occupancy?.moveOutDate && (
        <ScheduledEvent
          kind="move-out"
          details={[["Move-out", formatDate(space.occupancy.moveOutDate)]]}
          action={
            <CancelScheduledMoveOutButton
              tenancyId={space.occupancy.tenancyId}
            />
          }
        />
      )}
      {isRoom && !space.occupancy && space.upcomingOccupancy && (
        <ScheduledEvent
          kind="move-in"
          details={[
            [
              "Responsible",
              space.upcomingOccupancy.responsible?.fullName ?? "Not assigned",
            ],
            ["Move-in", formatDate(space.upcomingOccupancy.moveInDate)],
            [
              "Expected occupants",
              String(space.upcomingOccupancy.occupantCount),
            ],
          ]}
          action={
            <CancelUpcomingMoveInButton
              tenancyId={space.upcomingOccupancy.tenancyId}
            />
          }
        />
      )}
      {isRoom && space.occupancy && (
        <>
          <section className="tenancy-summary">
            <h3>Current tenancy</h3>
            <dl>
              <DetailLine
                label="Move-in"
                value={formatDate(space.occupancy.moveInDate)}
              />
              <DetailLine
                label="Monthly rent"
                value={formatVnd(space.occupancy.monthlyRentVnd)}
              />
              <DetailLine
                label="Deposit"
                value={
                  space.occupancy.depositVnd
                    ? formatVnd(space.occupancy.depositVnd)
                    : "Not recorded"
                }
              />
            </dl>
            {space.occupancy.moveInNotes && (
              <p className="space-notes">{space.occupancy.moveInNotes}</p>
            )}
          </section>
          <section className="occupants-section">
            <div className="section-heading-row">
              <h3>Occupants ({space.occupancy.occupantCount})</h3>
              <AddOccupantDialog
                compact
                space={space}
                people={people.filter(
                  (person) =>
                    !space.occupancy?.occupants.some(
                      (occupant) => occupant.personId === person.id,
                    ),
                )}
              />
            </div>
            <div className="occupant-summary">
              {[...space.occupancy.occupants].reverse().map((occupant) => (
                <p key={`${occupant.personId}-${occupant.startDate}`}>
                  <span>
                    <strong>{occupant.fullName}</strong>
                    {occupant.role === "RESPONSIBLE" ? (
                      <small className="!text-emerald-700">Responsible</small>
                    ) : (
                      <small>Additional</small>
                    )}
                  </span>
                  {occupant.role === "ADDITIONAL" && (
                    <EndOccupancyDialog
                      membershipId={occupant.membershipId}
                      personName={occupant.fullName}
                    />
                  )}
                </p>
              ))}
            </div>
          </section>
        </>
      )}
      <section>
        <h3>Basic information</h3>
        <dl>
          <DetailLine label="Floor" value={floor.name} />
          <DetailLine label="Type" value={SPACE_TYPE_LABELS[space.type]} />
          <DetailLine label="Display order" value={String(space.sortOrder)} />
          <DetailLine label="Record status" value="Active" />
        </dl>
      </section>
      <section>
        <h3>Notes</h3>
        <p className="space-notes">{space.notes || "No notes"}</p>
      </section>
      <div className="space-management">
        {isRoom &&
          (space.occupancy ? (
            <>
              {!space.occupancy.moveOutDate && <MoveOutDialog space={space} />}
            </>
          ) : !space.upcomingOccupancy ? (
            <MoveInDialog space={space} people={people} />
          ) : null)}
        <SpaceFormDialog
          mode="edit"
          floor={floor}
          space={space}
          trigger={
            <Button className="w-full">
              <Pencil />
              Edit space
            </Button>
          }
        />
        <div className="space-secondary-actions">
          <SpaceReorderButton
            floorId={floor.id}
            spaceId={space.id}
            direction="up"
            label="Move space left"
            icon={<ArrowLeft />}
          />
          <SpaceReorderButton
            floorId={floor.id}
            spaceId={space.id}
            direction="down"
            label="Move space right"
            icon={<ArrowRight />}
          />
          <ArchiveOrDeleteDialog
            entityName={space.name}
            description="Archive removes this space from active views and keeps its record. Delete permanently removes the record."
            archiveAction={archiveSpaceAction}
            archiveHidden={{ spaceId: space.id }}
            deleteAction={deleteSpaceAction}
            deleteHidden={{ spaceId: space.id }}
            canDelete
          />
        </div>
      </div>
    </div>
  );
}

function ScheduledEvent({
  kind,
  details,
  action,
}: {
  kind: "move-in" | "move-out";
  details: Array<[label: string, value: string]>;
  action: React.ReactNode;
}) {
  const Icon = kind === "move-in" ? CalendarDays : LogOut;
  return (
    <section className={`scheduled-event scheduled-${kind}`}>
      <div className="scheduled-event-title">
        <span className="scheduled-event-icon">
          <Icon aria-hidden="true" />
        </span>
        <h3>
          {kind === "move-in" ? "Upcoming move-in" : "Scheduled move-out"}
        </h3>
      </div>
      <dl>
        {details.map(([label, value]) => (
          <DetailLine key={label} label={label} value={value} />
        ))}
      </dl>
      {action}
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-line">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
