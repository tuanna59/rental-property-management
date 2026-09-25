"use client";

import * as React from "react";
import Link from "next/link";
import { MotionConfig } from "motion/react";
import {
  Building2,
  Home,
  Pencil,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { archiveSpaceAction, deleteSpaceAction } from "../actions";
import {
  SPACE_TYPE_LABELS,
  type DashboardProperty,
  type DashboardFloor,
  type DashboardSpace,
} from "../domain/types";
import { BuildingCanvas } from "./building-canvas";
import {
  PropertyFormDialog,
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
}: {
  property: DashboardProperty;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
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
      <main className="property-app">
        <aside className="property-rail" aria-label="Property navigation">
          <Link href="/" className="rail-brand" title="Property overview">
            <Home aria-hidden="true" />
            <span className="sr-only">Property overview</span>
          </Link>
          <a
            href="#building"
            className="rail-current"
            aria-label="Building"
            title="Building"
          >
            <Building2 aria-hidden="true" />
          </a>
        </aside>
        <div className="property-workspace">
          <header className="property-header">
            <div className="property-heading">
              <p className="eyebrow">PROPERTY OVERVIEW</p>
              <h1>{property.name}</h1>
              <p>
                {[property.addressLine1, property.city, property.country]
                  .filter(Boolean)
                  .join(", ") || property.description}
              </p>
            </div>
            <div className="property-controls">
              <PropertyFormDialog property={property} />
              <Button
                variant={editing ? "secondary" : "outline"}
                aria-pressed={editing}
                onClick={() => setEditing(!editing)}
              >
                <Pencil />
                {editing ? "Done editing" : "Edit building"}
              </Button>
              <FloorFormDialog
                mode="create"
                propertyId={property.id}
                trigger={
                  <Button>
                    <Plus />
                    Add floor
                  </Button>
                }
              />
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
                    <SpaceDetails key={selected.space.id} {...selected} />
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
        </div>
        {!desktop && (
          <Dialog
            open={Boolean(selected)}
            onOpenChange={(open) => {
              if (!open) close();
            }}
          >
            <DialogContent
              className="space-sheet"
              style={{
                left: 0,
                top: "auto",
                bottom: 0,
                width: "100%",
                maxWidth: "none",
                maxHeight: "85dvh",
                transform: "none",
                translate: "none",
                overflowY: "auto",
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                lastSelected.current?.focus();
              }}
            >
              <DialogTitle className="sr-only">
                {selected?.space.name ?? "Space details"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Space information and management
              </DialogDescription>
              {selected && (
                <SpaceDetails key={selected.space.id} {...selected} />
              )}
            </DialogContent>
          </Dialog>
        )}
      </main>
    </MotionConfig>
  );
}

function SpaceDetails({
  floor,
  space,
}: {
  floor: DashboardFloor;
  space: DashboardSpace;
}) {
  return (
    <div className="space-details">
      <p className="eyebrow">SPACE OVERVIEW</p>
      <h2>{space.name}</h2>
      <p className="space-type">{SPACE_TYPE_LABELS[space.type]}</p>
      <div className="active-status">
        <i />
        Active
      </div>
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

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-line">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
