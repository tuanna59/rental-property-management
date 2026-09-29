"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  ChevronDown,
  ChevronUp,
  Gauge,
  ListTodo,
  Pencil,
  Plus,
  Users,
  Wifi,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate, formatVnd } from "@/lib/presentation";
import { AssetFormDialog } from "@/modules/assets/components/asset-dialogs";
import type {
  AssetInventoryPageView,
  DevicePageView,
} from "@/modules/assets/domain/types";
import {
  MaintenanceFormDialog,
  TaskFormDialog,
} from "@/modules/operations/components/operation-dialogs";
import type {
  MaintenancePageView,
  TaskPageView,
} from "@/modules/operations/domain/types";
import {
  AddOccupantDialog,
  CancelScheduledMoveOutButton,
  CancelUpcomingMoveInButton,
  EndOccupancyDialog,
  MoveInDialog,
  MoveOutDialog,
} from "@/modules/tenancy/components/tenancy-dialogs";
import { MeterReadingDialog } from "@/modules/utilities/components/meter-reading-dialog";

import { archiveSpaceAction, deleteSpaceAction } from "../actions";
import {
  SPACE_TYPE_LABELS,
  type BuildingVisualSpaceProjection,
  type DashboardFloor,
  type DashboardPersonOption,
} from "../domain/types";
import {
  ArchiveOrDeleteDialog,
  SpaceFormDialog,
  SpaceReorderButton,
} from "./property-forms";

export type SpaceInspectorTab =
  | "OVERVIEW"
  | "RENTAL"
  | "UTILITIES"
  | "OPERATIONS"
  | "ASSETS";

export type BuildingInspectorData = {
  maintenance: MaintenancePageView;
  tasks: TaskPageView;
  assets: AssetInventoryPageView;
  devices: DevicePageView;
};

const tabs: Array<{ value: SpaceInspectorTab; label: string }> = [
  { value: "OVERVIEW", label: "Overview" },
  { value: "RENTAL", label: "Rental" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "ASSETS", label: "Assets" },
];

export function SpaceInspector({
  propertyId,
  floor,
  space,
  people,
  data,
  tab,
  side,
  onTabChange,
  onClose,
}: {
  propertyId: string;
  floor: DashboardFloor;
  space: BuildingVisualSpaceProjection;
  people: DashboardPersonOption[];
  data: BuildingInspectorData;
  tab: SpaceInspectorTab;
  side: "left" | "right";
  onTabChange: (tab: SpaceInspectorTab) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const layerRef = React.useRef<HTMLDivElement | null>(null);
  const inspectorRef = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    const layer = layerRef.current;
    const inspector = inspectorRef.current;
    if (!layer || !inspector) return;

    let frame = 0;
    const updatePosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.matchMedia("(max-width: 760px)").matches) {
          layer.style.removeProperty("--space-inspector-top");
          return;
        }

        const target = Array.from(
          document.querySelectorAll<HTMLElement>("[data-space-id]"),
        ).find((element) => element.dataset.spaceId === space.id);
        if (!target) return;

        const layerRect = layer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const inspectorRect = inspector.getBoundingClientRect();
        const viewportGap = window.innerWidth < 1100 ? 12 : 18;
        const panelHeight = Math.min(
          inspectorRect.height || 736,
          Math.max(260, window.innerHeight - viewportGap * 2),
        );

        // Keep the panel close to the selected room, but never let it escape the
        // usable viewport or the BuildingStage. This makes lower-floor spaces
        // convenient to inspect without binding panel height to building height.
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const desiredViewportTop = targetCenterY - panelHeight / 2;
        const viewportTop = Math.min(
          Math.max(desiredViewportTop, viewportGap),
          Math.max(viewportGap, window.innerHeight - panelHeight - viewportGap),
        );

        const maxLayerTop = Math.max(
          viewportGap,
          layerRect.height - panelHeight - viewportGap,
        );
        const layerTop = Math.min(
          Math.max(viewportTop - layerRect.top, viewportGap),
          maxLayerTop,
        );

        layer.style.setProperty("--space-inspector-top", `${Math.round(layerTop)}px`);
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { passive: true });
    const observer = new ResizeObserver(updatePosition);
    observer.observe(inspector);
    observer.observe(layer);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
      observer.disconnect();
    };
  }, [space.id]);

  const occupied = Boolean(space.occupancy);
  const status = space.type === "ROOM"
    ? occupied
      ? `Occupied · ${space.occupancy?.occupantCount ?? 0} ${space.occupancy?.occupantCount === 1 ? "resident" : "residents"}`
      : space.upcomingOccupancy
        ? "Available · upcoming tenancy"
        : "Available"
    : "Active space";

  return (
    <div ref={layerRef} className={`space-inspector-layer is-${side}`}>
      <motion.aside
        ref={inspectorRef}
        layout="position"
        initial={{ opacity: 0, x: side === "right" ? 18 : -18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: side === "right" ? 18 : -18 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className={`space-inspector${expanded ? " is-expanded" : ""}`}
        aria-label={`${space.name} space overview`}
      >
      <header className="space-inspector-header">
        <div className="space-inspector-heading">
          <p>SPACE OVERVIEW</p>
          <div>
            <h2>{space.name}</h2>
            <span>{SPACE_TYPE_LABELS[space.type]}</span>
          </div>
          <strong className={occupied ? "is-occupied" : ""}>{status}</strong>
        </div>
        <div className="space-inspector-header-actions">
          <button
            type="button"
            className="space-inspector-expand"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Collapse space overview" : "Expand space overview"}
          >
            {expanded ? <ChevronDown /> : <ChevronUp />}
          </button>
          <button type="button" className="space-inspector-close" onClick={onClose} aria-label="Close space overview">
            <X />
          </button>
        </div>
      </header>

      <nav className="space-inspector-tabs" aria-label="Space overview sections">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            className={tab === item.value ? "is-active" : ""}
            aria-current={tab === item.value ? "page" : undefined}
            onClick={() => onTabChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <motion.div
        key={`${space.id}-${tab}`}
        initial={{ opacity: 0.65 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
        className={`space-inspector-body${tab === "OVERVIEW" ? " is-overview" : " is-scrollable"}`}
      >
        {tab === "OVERVIEW" && (
          <OverviewTab
            floor={floor}
            space={space}
            data={data}
          />
        )}
        {tab === "RENTAL" && <RentalTab space={space} people={people} />}
        {tab === "UTILITIES" && <UtilitiesTab space={space} />}
        {tab === "OPERATIONS" && (
          <OperationsTab propertyId={propertyId} floor={floor} space={space} data={data} />
        )}
        {tab === "ASSETS" && (
          <AssetsTab propertyId={propertyId} floor={floor} space={space} data={data} />
        )}

        {tab === "OVERVIEW" && (
          <SpaceManagement floor={floor} space={space} />
        )}
      </motion.div>
      </motion.aside>
    </div>
  );
}

function OverviewTab({
  floor,
  space,
  data,
}: {
  floor: DashboardFloor;
  space: BuildingVisualSpaceProjection;
  data: BuildingInspectorData;
}) {
  const activeIssues = data.maintenance.items.filter(
    (item) => item.spaceId === space.id && item.status !== "COMPLETED",
  );
  const openTasks = data.tasks.items.filter(
    (item) =>
      item.status === "TODO" &&
      item.linkedEntityType === "SPACE" &&
      item.linkedEntityId === space.id,
  );
  const assets = data.assets.items.filter(
    (item) => item.spaceId === space.id && item.status === "ACTIVE",
  );
  const devices = data.devices.items.filter((item) => item.spaceId === space.id);
  const tenantNames = space.occupancy?.occupants.map((item) => item.fullName).join(" + ");

  return (
    <div className="space-inspector-sections space-inspector-overview-sections">
      <section className="space-inspector-basic is-primary-context">
        <div className="space-inspector-section-title">
          <h3>Basic information</h3>
        </div>
        <dl className="space-inspector-basic-grid">
          <DetailLine label="Floor" value={floor.name} />
          <DetailLine label="Type" value={SPACE_TYPE_LABELS[space.type]} />
          <DetailLine label="Record status" value="Active" />
        </dl>
      </section>

      <InspectorSection title="Current rental" icon={<Users />}>
        {space.type !== "ROOM" ? (
          <p className="space-inspector-muted">This is not a rental room.</p>
        ) : space.occupancy ? (
          <>
            <strong>{tenantNames || space.occupancy.responsible?.fullName || "Occupied"}</strong>
            <p>{formatVnd(space.occupancy.monthlyRentVnd)} / month</p>
            <p className="space-inspector-muted">Since {formatDate(space.occupancy.moveInDate)}</p>
          </>
        ) : space.upcomingOccupancy ? (
          <>
            <strong>Upcoming tenancy</strong>
            <p>Starts {formatDate(space.upcomingOccupancy.moveInDate)}</p>
          </>
        ) : (
          <p className="space-inspector-muted">Available · no current or upcoming tenant.</p>
        )}
      </InspectorSection>

      <InspectorSection title="Utilities" icon={<Gauge />}>
        <strong>{space.utilities.hasElectricityMeter ? space.utilities.meterNumber || "Electricity meter" : "No electricity meter"}</strong>
        <p>{utilityStatus(space)}</p>
      </InspectorSection>

      <InspectorSection title="Operations" icon={<Wrench />}>
        <strong>{activeIssues.length} active maintenance {activeIssues.length === 1 ? "issue" : "issues"}</strong>
        <p>{openTasks.filter((item) => item.overdue).length} overdue tasks</p>
      </InspectorSection>

      <InspectorSection title="Assets & Devices" icon={<Boxes />}>
        <strong>{assets.length} active {assets.length === 1 ? "asset" : "assets"}</strong>
        <p>{devices.length} registered {devices.length === 1 ? "device" : "devices"}</p>
      </InspectorSection>

      <div className="space-inspector-notes is-standalone">
        <span>Notes</span>
        <p>{space.notes || "No notes"}</p>
      </div>
    </div>
  );
}

function RentalTab({
  space,
  people,
}: {
  space: BuildingVisualSpaceProjection;
  people: DashboardPersonOption[];
}) {
  if (space.type !== "ROOM") {
    return <EmptyState icon={<Users />} title="Not a rental space" copy="Rental workflows apply only to rental rooms." />;
  }

  if (!space.occupancy) {
    return (
      <div className="space-inspector-sections">
        {space.upcomingOccupancy ? (
          <InspectorSection title="Upcoming tenancy" icon={<Users />}>
            <strong>Starts {formatDate(space.upcomingOccupancy.moveInDate)}</strong>
            <p>{space.upcomingOccupancy.responsible?.fullName || "Responsible renter not assigned"}</p>
            <p>{space.upcomingOccupancy.occupantCount} expected {space.upcomingOccupancy.occupantCount === 1 ? "occupant" : "occupants"}</p>
            <CancelUpcomingMoveInButton tenancyId={space.upcomingOccupancy.tenancyId} />
          </InspectorSection>
        ) : (
          <InspectorSection title="Available" icon={<Users />}>
            <strong>No current or upcoming tenant</strong>
            <p className="space-inspector-muted">This room is ready for a new tenancy.</p>
            <MoveInDialog space={space} people={people} />
          </InspectorSection>
        )}
      </div>
    );
  }

  const availablePeople = people.filter(
    (person) => !space.occupancy?.occupants.some((occupant) => occupant.personId === person.id),
  );

  return (
    <div className="space-inspector-sections">
      {space.occupancy.moveOutDate && (
        <InspectorSection title="Scheduled move-out" icon={<Users />}>
          <strong>{formatDate(space.occupancy.moveOutDate)}</strong>
          <CancelScheduledMoveOutButton tenancyId={space.occupancy.tenancyId} />
        </InspectorSection>
      )}
      <InspectorSection title="Current tenancy" icon={<Users />}>
        <strong>{formatDate(space.occupancy.moveInDate)} → {space.occupancy.moveOutDate ? formatDate(space.occupancy.moveOutDate) : "Ongoing"}</strong>
        <dl className="space-inspector-inline-dl">
          <DetailLine label="Monthly rent" value={formatVnd(space.occupancy.monthlyRentVnd)} />
          <DetailLine label="Deposit" value={space.occupancy.depositVnd ? formatVnd(space.occupancy.depositVnd) : "Not recorded"} />
        </dl>
        {!space.occupancy.moveOutDate && <MoveOutDialog space={space} />}
      </InspectorSection>

      <InspectorSection title={`Occupants (${space.occupancy.occupantCount})`} icon={<Users />}>
        <div className="space-inspector-list">
          {space.occupancy.occupants.map((occupant) => (
            <div key={occupant.membershipId} className="space-inspector-list-row">
              <div>
                <strong>{occupant.fullName}</strong>
                <span>{occupant.role === "RESPONSIBLE" ? "Responsible" : "Additional"}</span>
              </div>
              {occupant.role === "ADDITIONAL" && (
                <EndOccupancyDialog membershipId={occupant.membershipId} personName={occupant.fullName} />
              )}
            </div>
          ))}
        </div>
        <AddOccupantDialog compact space={space} people={availablePeople} />
      </InspectorSection>
    </div>
  );
}

function UtilitiesTab({ space }: { space: BuildingVisualSpaceProjection }) {
  return (
    <div className="space-inspector-sections">
      <InspectorSection title="Electricity" icon={<Gauge />}>
        {space.utilities.hasElectricityMeter ? (
          <>
            <strong>{space.utilities.meterNumber || "Electricity meter"}</strong>
            <dl className="space-inspector-inline-dl">
              <DetailLine label="Latest reading" value={space.utilities.latestReadingValue ?? "—"} />
              <DetailLine label="Current closing" value={space.utilities.monthlyClosingValue ?? "—"} />
              <DetailLine label="Known usage" value={space.utilities.knownUsageKwh ? `${space.utilities.knownUsageKwh} kWh` : "—"} />
              <DetailLine label="Status" value={utilityStatus(space)} />
            </dl>
            <div className="space-inspector-actions">
              {space.utilities.activeMeterId && <MeterReadingDialog meterId={space.utilities.activeMeterId} />}
              <Button size="sm" variant="outline" asChild><a href={`/utilities/meters?space=${space.id}`}>View meter</a></Button>
              <Button size="sm" variant="ghost" asChild><a href="/utilities">Open Utilities</a></Button>
            </div>
          </>
        ) : (
          <>
            <p className="space-inspector-muted">No electricity meter is linked to this space.</p>
            <Button size="sm" variant="outline" asChild><a href={`/utilities/meters?space=${space.id}`}>Open meters</a></Button>
          </>
        )}
      </InspectorSection>

      <InspectorSection title="Water" icon={<Gauge />}>
        {space.type === "ROOM" ? (
          <>
            <strong>{space.occupancy?.occupantCount ?? 0} current {space.occupancy?.occupantCount === 1 ? "occupant" : "occupants"}</strong>
            <p>Fixed per occupant</p>
            <p className="space-inspector-muted">Billing calculation remains in the existing Utilities/Billing workflow.</p>
          </>
        ) : (
          <p className="space-inspector-muted">No room-level occupant water summary for this space type.</p>
        )}
      </InspectorSection>
    </div>
  );
}

function OperationsTab({
  propertyId,
  floor,
  space,
  data,
}: {
  propertyId: string;
  floor: DashboardFloor;
  space: BuildingVisualSpaceProjection;
  data: BuildingInspectorData;
}) {
  const activeIssues = data.maintenance.items.filter(
    (item) => item.spaceId === space.id && item.status !== "COMPLETED",
  );
  const tasks = data.tasks.items.filter(
    (item) =>
      item.status === "TODO" &&
      item.linkedEntityType === "SPACE" &&
      item.linkedEntityId === space.id,
  );

  return (
    <div className="space-inspector-sections">
      <InspectorSection title="Maintenance" icon={<Wrench />}>
        <strong>{activeIssues.length} active {activeIssues.length === 1 ? "issue" : "issues"}</strong>
        <div className="space-inspector-list">
          {activeIssues.slice(0, 4).map((issue) => (
            <a key={issue.id} className="space-inspector-list-row is-link" href={`/operations/maintenance?space=${space.id}&issue=${issue.id}`}>
              <div><strong>{issue.title}</strong><span>{titleCase(issue.priority)} · {titleCase(issue.status)}</span></div>
            </a>
          ))}
          {!activeIssues.length && <p className="space-inspector-muted">No active maintenance issues.</p>}
        </div>
        <div className="space-inspector-actions">
          <MaintenanceFormDialog
            propertyId={propertyId}
            locations={data.maintenance.locations}
            assetOptions={data.maintenance.assetOptions}
            defaultFloorId={floor.id}
            defaultSpaceId={space.id}
            trigger={<Button size="sm"><Plus /> Report issue</Button>}
          />
          <Button size="sm" variant="outline" asChild><a href={`/operations/maintenance?space=${space.id}`}>View maintenance</a></Button>
        </div>
      </InspectorSection>

      <InspectorSection title="Tasks" icon={<ListTodo />}>
        <strong>{tasks.length} upcoming</strong>
        <div className="space-inspector-list">
          {tasks.slice(0, 4).map((task) => (
            <div key={task.id} className="space-inspector-list-row">
              <div><strong>{task.title}</strong><span>{task.dueDate ? formatDate(task.dueDate) : "No due date"}{task.overdue ? " · Overdue" : ""}</span></div>
            </div>
          ))}
          {!tasks.length && <p className="space-inspector-muted">No tasks linked to this room.</p>}
        </div>
        <div className="space-inspector-actions">
          <TaskFormDialog
            propertyId={propertyId}
            locations={data.tasks.locations}
            maintenanceOptions={data.tasks.maintenanceOptions}
            invoiceOptions={data.tasks.invoiceOptions}
            defaultLinkedEntityType="SPACE"
            defaultLinkedEntityId={space.id}
            trigger={<Button size="sm"><Plus /> Add task</Button>}
          />
          <Button size="sm" variant="outline" asChild><a href="/operations/tasks">View tasks</a></Button>
        </div>
      </InspectorSection>
    </div>
  );
}

function AssetsTab({
  propertyId,
  floor,
  space,
  data,
}: {
  propertyId: string;
  floor: DashboardFloor;
  space: BuildingVisualSpaceProjection;
  data: BuildingInspectorData;
}) {
  const assets = data.assets.items.filter((item) => item.spaceId === space.id && item.status !== "DISPOSED");
  const devices = data.devices.items.filter((item) => item.spaceId === space.id);
  const online = devices.filter((item) => item.status === "ONLINE").length;
  const unknown = devices.filter((item) => item.status === "UNKNOWN").length;

  return (
    <div className="space-inspector-sections">
      <InspectorSection title="Assets" icon={<Boxes />}>
        <strong>{assets.filter((item) => item.status === "ACTIVE").length} active</strong>
        <p>{assets.filter((item) => item.underMaintenance).length} under maintenance</p>
        <div className="space-inspector-list">
          {assets.slice(0, 5).map((asset) => (
            <a key={asset.id} className="space-inspector-list-row is-link" href={`/assets/${asset.id}`}>
              <div><strong>{asset.name}</strong><span>{asset.categoryName} · {titleCase(asset.status)}</span></div>
            </a>
          ))}
          {!assets.length && <p className="space-inspector-muted">No tracked assets in this space.</p>}
        </div>
        <div className="space-inspector-actions">
          <AssetFormDialog
            propertyId={propertyId}
            categories={data.assets.categories}
            locations={data.assets.locations}
            defaultFloorId={floor.id}
            defaultSpaceId={space.id}
            trigger={<Button size="sm"><Plus /> Add asset</Button>}
          />
          <Button size="sm" variant="outline" asChild><a href={`/assets?location=${space.id}`}>View assets</a></Button>
        </div>
      </InspectorSection>

      <InspectorSection title="Devices" icon={<Wifi />}>
        <strong>{devices.length} registered</strong>
        <p>{online} online · {unknown} unknown</p>
        <div className="space-inspector-list">
          {devices.slice(0, 5).map((device) => (
            <div key={device.id} className="space-inspector-list-row">
              <div><strong>{device.name}</strong><span>{device.deviceType} · {titleCase(device.status)}</span></div>
            </div>
          ))}
          {!devices.length && <p className="space-inspector-muted">No devices linked to this space.</p>}
        </div>
        <Button size="sm" variant="outline" asChild><a href="/assets/devices">View devices</a></Button>
      </InspectorSection>
    </div>
  );
}

function SpaceManagement({
  floor,
  space,
}: {
  floor: DashboardFloor;
  space: BuildingVisualSpaceProjection;
}) {
  return (
    <details className="space-inspector-manage">
      <summary>Space management</summary>
      <div>
        <span className="space-inspector-management-meta">Display order {space.sortOrder}</span>
        <SpaceFormDialog
          mode="edit"
          floor={floor}
          space={space}
          trigger={<Button size="sm" variant="outline"><Pencil /> Edit space</Button>}
        />
        <SpaceReorderButton floorId={floor.id} spaceId={space.id} direction="up" label="Move space left" icon={<ArrowLeft />} />
        <SpaceReorderButton floorId={floor.id} spaceId={space.id} direction="down" label="Move space right" icon={<ArrowRight />} />
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
    </details>
  );
}

function InspectorSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-inspector-section">
      <div className="space-inspector-section-title"><span>{icon}</span><h3>{title}</h3></div>
      <div className="space-inspector-section-content">{children}</div>
    </section>
  );
}


function DetailLine({ label, value }: { label: string; value: string }) {
  return <div className="space-inspector-detail-line"><dt>{label}</dt><dd>{value}</dd></div>;
}

function EmptyState({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="space-inspector-empty"><span>{icon}</span><strong>{title}</strong><p>{copy}</p></div>;
}

function utilityStatus(space: BuildingVisualSpaceProjection) {
  if (!space.utilities.hasElectricityMeter) return "No electricity meter";
  if (space.utilities.missingBoundary) return "Boundary attention required";
  if (space.utilities.needsClosing) return "Monthly closing required";
  if (space.utilities.attentionCount) return `${space.utilities.attentionCount} utility warning${space.utilities.attentionCount === 1 ? "" : "s"}`;
  return "Healthy";
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
