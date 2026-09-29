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
  Search,
  CalendarDays,
  LogOut,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatVnd } from "@/lib/presentation";
import { archiveSpaceAction, deleteSpaceAction } from "../actions";
import {
  SPACE_TYPE_LABELS,
  type DashboardProperty,
  type DashboardFloor,
  type DashboardSpace,
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
import { BuildingCanvas } from "./building-canvas";
import {
  FloorFormDialog,
  SpaceFormDialog,
  SpaceReorderButton,
  ArchiveOrDeleteDialog,
} from "./property-forms";
import type { SpaceMaintenanceSignal } from "@/modules/operations/domain/types";
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
  maintenanceSignals = [],
  initialSpaceId = null,
}: {
  property: DashboardProperty;
  people: DashboardPersonOption[];
  maintenanceSignals?: SpaceMaintenanceSignal[];
  initialSpaceId?: string | null;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSpaceId);
  const [editing, setEditing] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const desktop = React.useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    () => false,
  );
  const lastSelected = React.useRef<HTMLButtonElement | null>(null);
  const floors = [...property.floors].sort((a, b) => {
    const aRooftop =
      a.spaces.length > 0 &&
      a.spaces.every((space) => space.type === "ROOFTOP");
    const bRooftop =
      b.spaces.length > 0 &&
      b.spaces.every((space) => space.type === "ROOFTOP");
    return aRooftop === bRooftop
      ? b.sortOrder - a.sortOrder
      : aRooftop
        ? -1
        : 1;
  });
  const spaces = floors.flatMap((floor) => floor.spaces);
  const floor = floors.find((item) =>
    item.spaces.some((space) => space.id === selectedId),
  );
  const space = floor?.spaces.find((item) => item.id === selectedId);
  const selected = floor && space ? { floor, space } : null;
  const close = () => {
    setSelectedId(null);
    requestAnimationFrame(() => lastSelected.current?.focus());
  };
  const select = (id: string, target: HTMLButtonElement) => {
    lastSelected.current = target;
    setSelectedId(id);
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="property-workspace">
          <header className="property-header">
            <div className="property-heading">
              <p className="property-eyebrow">BUILDING</p>
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
          <div className="canvas-toolbar">
            <div className="building-caption">
              <Building2 size={17} />
              <span>Building</span>
              <span className="caption-divider" />
              <span>{floors.length} floors</span>
              <span>
                {spaces.filter((s) => s.type === "ROOM").length} rooms
              </span>
              <span className="other-count">
                {spaces.filter((s) => s.type !== "ROOM").length} other spaces
              </span>
            </div>
            <label className="space-search">
              <Search size={16} />
              <span className="sr-only">Find a space</span>
              <input
                type="search"
                placeholder="Find a space"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="property-scene">
            <section
              id="building"
              aria-label="Interactive building cutaway"
              className="canvas-region"
            >
              <BuildingCanvas
                floors={floors}
                propertyId={property.id}
                selectedId={selectedId}
                onSelect={select}
                editing={editing}
                search={search}
              />
              <footer className="canvas-legend">
                <span>
                  <i />
                  Active space
                </span>
                <span>{spaces.length} spaces in this property</span>
              </footer>
              {search &&
                !spaces.some((s) =>
                  s.name.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <p className="search-empty" role="status">
                    No spaces match &quot;{search}&quot;.
                  </p>
                )}
            </section>
            {desktop && (
              <aside className="context-panel" aria-label="Space details">
                {selected ? (
                  <>
                    <button
                      className="panel-close"
                      onClick={close}
                      aria-label="Close detail panel"
                      title="Close detail panel"
                    >
                      <X size={18} />
                    </button>
                    <SpaceDetails
                      key={selected.space.id}
                      {...selected}
                      people={people}
                      maintenanceSignal={maintenanceSignals.find(
                        (signal) => signal.spaceId === selected.space.id,
                      )}
                    />
                  </>
                ) : (
                  <div className="panel-empty">
                    <Building2 size={30} />
                    <h2>Space details</h2>
                    <p>No space selected</p>
                    <div className="property-note">{property.description}</div>
                  </div>
                )}
              </aside>
            )}
          </div>
        {!desktop && selected && (
          <div className="mobile-space-layer">
            <button
              type="button"
              className="mobile-space-backdrop"
              aria-label="Close space details"
              onClick={close}
            />
            <section
              className="space-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`${selected.space.name} details`}
            >
              <button
                type="button"
                className="panel-close"
                onClick={close}
                aria-label="Close space details"
              >
                <X />
              </button>
              <SpaceDetails
                key={selected.space.id}
                {...selected}
                people={people}
                maintenanceSignal={maintenanceSignals.find(
                  (signal) => signal.spaceId === selected.space.id,
                )}
              />
            </section>
          </div>
        )}
      </main>
    </MotionConfig>
  );
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
  maintenanceSignal,
}: {
  floor: DashboardFloor;
  space: DashboardSpace;
  people: DashboardPersonOption[];
  maintenanceSignal?: SpaceMaintenanceSignal;
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
      {maintenanceSignal && maintenanceSignal.openCount > 0 && (
        <section className="space-maintenance-signal">
          <div>
            <span className="space-maintenance-icon"><Wrench aria-hidden="true" /></span>
            <div>
              <strong>Maintenance</strong>
              <p>
                {maintenanceSignal.openCount} open issue{maintenanceSignal.openCount === 1 ? "" : "s"}
                {maintenanceSignal.urgentCount > 0
                  ? ` · ${maintenanceSignal.urgentCount} urgent`
                  : ""}
              </p>
            </div>
          </div>
          <a href={`/operations/maintenance?space=${space.id}`}>View maintenance</a>
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
