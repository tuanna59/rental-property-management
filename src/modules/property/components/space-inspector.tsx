"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
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
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatVndLocale } from "@/i18n/format";
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
  type BuildingVisualSpaceProjection,
  type DashboardFloor,
  type DashboardPersonOption,
} from "../domain/types";
import { SPACE_TYPE_KEYS, enumStatusKey } from "./visual/building-copy";
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
  const t = useTranslations("building");
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
      ? t("spaceState.occupiedSummary", { count: space.occupancy?.occupantCount ?? 0 })
      : space.upcomingOccupancy
        ? t("spaceState.availableUpcoming")
        : t("spaceState.available")
    : t("spaceState.activeSpace");

  const tabs: Array<{ value: SpaceInspectorTab; label: string }> = [
    { value: "OVERVIEW", label: t("inspector.tabs.overview") },
    { value: "RENTAL", label: t("inspector.tabs.rental") },
    { value: "UTILITIES", label: t("inspector.tabs.utilities") },
    { value: "OPERATIONS", label: t("inspector.tabs.operations") },
    { value: "ASSETS", label: t("inspector.tabs.assets") },
  ];

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
        aria-label={t("inspector.ariaLabel", { space: space.name })}
      >
      <header className="space-inspector-header">
        <div className="space-inspector-heading">
          <p>{t("inspector.title").toUpperCase()}</p>
          <div>
            <h2>{space.name}</h2>
            <span>{t(`spaceTypes.${SPACE_TYPE_KEYS[space.type]}`)}</span>
          </div>
          <strong className={occupied ? "is-occupied" : ""}>{status}</strong>
        </div>
        <div className="space-inspector-header-actions">
          <button
            type="button"
            className="space-inspector-expand"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? t("inspector.collapse") : t("inspector.expand")}
          >
            {expanded ? <ChevronDown /> : <ChevronUp />}
          </button>
          <button type="button" className="space-inspector-close" onClick={onClose} aria-label={t("inspector.close")}>
            <X />
          </button>
        </div>
      </header>

      <nav className="space-inspector-tabs" aria-label={t("inspector.sectionsLabel")}>
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
  const t = useTranslations("building");
  const locale = useLocale() as AppLocale;
  const utilityStatusLabel = () => {
    if (!space.utilities.hasElectricityMeter) return t("inspector.noElectricityMeter");
    if (space.utilities.missingBoundary) return t("utilities.boundaryAttention");
    if (space.utilities.needsClosing) return t("utilities.monthlyClosingRequired");
    if (space.utilities.attentionCount) return t("utilities.utilityWarnings", { count: space.utilities.attentionCount });
    return t("utilities.healthy");
  };
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
          <h3>{t("inspector.basicInformation")}</h3>
        </div>
        <dl className="space-inspector-basic-grid">
          <DetailLine label={t("floor")} value={floor.name} />
          <DetailLine label={t("forms.type")} value={t(`spaceTypes.${SPACE_TYPE_KEYS[space.type]}`)} />
          <DetailLine label={t("inspector.recordStatus")} value={t("inspector.active")} />
        </dl>
      </section>

      <InspectorSection title={t("inspector.currentRental")} icon={<Users />}>
        {space.type !== "ROOM" ? (
          <p className="space-inspector-muted">{t("inspector.notRentalRoom")}</p>
        ) : space.occupancy ? (
          <>
            <strong>{tenantNames || space.occupancy.responsible?.fullName || t("inspector.occupied")}</strong>
            <p>{t("inspector.perMonth", { amount: formatVndLocale(space.occupancy.monthlyRentVnd, locale) })}</p>
            <p className="space-inspector-muted">{t("inspector.since", { date: formatDateOnlyLocale(space.occupancy.moveInDate, locale) })}</p>
          </>
        ) : space.upcomingOccupancy ? (
          <>
            <strong>{t("inspector.upcomingTenancy")}</strong>
            <p>{t("inspector.starts", { date: formatDateOnlyLocale(space.upcomingOccupancy.moveInDate, locale) })}</p>
          </>
        ) : (
          <p className="space-inspector-muted">{t("inspector.availableNoTenant")}</p>
        )}
      </InspectorSection>

      <InspectorSection title={t("toolbar.utilities")} icon={<Gauge />}>
        <strong>{space.utilities.hasElectricityMeter ? space.utilities.meterNumber || t("inspector.electricityMeter") : t("inspector.noElectricityMeter")}</strong>
        <p>{utilityStatusLabel()}</p>
      </InspectorSection>

      <InspectorSection title={t("inspector.operations")} icon={<Wrench />}>
        <strong>{t("inspector.activeMaintenanceIssues", { count: activeIssues.length })}</strong>
        <p>{t("inspector.overdueTasks", { count: openTasks.filter((item) => item.overdue).length })}</p>
      </InspectorSection>

      <InspectorSection title={t("inspector.assetsDevices")} icon={<Boxes />}>
        <strong>{t("inspector.activeAssets", { count: assets.length })}</strong>
        <p>{t("inspector.registeredDevices", { count: devices.length })}</p>
      </InspectorSection>

      <div className="space-inspector-notes is-standalone">
        <span>{t("inspector.notes")}</span>
        <p>{space.notes || t("inspector.noNotes")}</p>
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
  const t = useTranslations("building");
  const locale = useLocale() as AppLocale;
  if (space.type !== "ROOM") {
    return <EmptyState icon={<Users />} title={t("rental.notRentalSpace")} copy={t("rental.rentalOnly")} />;
  }

  if (!space.occupancy) {
    return (
      <div className="space-inspector-sections">
        {space.upcomingOccupancy ? (
          <InspectorSection title={t("rental.upcomingTenancy")} icon={<Users />}>
            <strong>{t("rental.starts", { date: formatDateOnlyLocale(space.upcomingOccupancy.moveInDate, locale) })}</strong>
            <p>{space.upcomingOccupancy.responsible?.fullName || t("rental.responsibleNotAssigned")}</p>
            <p>{t("rental.expectedOccupants", { count: space.upcomingOccupancy.occupantCount })}</p>
            <CancelUpcomingMoveInButton tenancyId={space.upcomingOccupancy.tenancyId} />
          </InspectorSection>
        ) : (
          <InspectorSection title={t("rental.available")} icon={<Users />}>
            <strong>{t("rental.noCurrentUpcoming")}</strong>
            <p className="space-inspector-muted">{t("rental.readyForTenancy")}</p>
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
        <InspectorSection title={t("rental.scheduledMoveOut")} icon={<Users />}>
          <strong>{formatDateOnlyLocale(space.occupancy.moveOutDate, locale)}</strong>
          <CancelScheduledMoveOutButton tenancyId={space.occupancy.tenancyId} />
        </InspectorSection>
      )}
      <InspectorSection title={t("rental.currentTenancy")} icon={<Users />}>
        <strong>{formatDateOnlyLocale(space.occupancy.moveInDate, locale)} → {space.occupancy.moveOutDate ? formatDateOnlyLocale(space.occupancy.moveOutDate, locale) : t("rental.ongoing")}</strong>
        <dl className="space-inspector-inline-dl">
          <DetailLine label={t("rental.monthlyRent")} value={formatVndLocale(space.occupancy.monthlyRentVnd, locale)} />
          <DetailLine label={t("rental.deposit")} value={space.occupancy.depositVnd ? formatVndLocale(space.occupancy.depositVnd, locale) : t("rental.notRecorded")} />
        </dl>
        {!space.occupancy.moveOutDate && <MoveOutDialog space={space} />}
      </InspectorSection>

      <InspectorSection title={t("rental.occupants", { count: space.occupancy.occupantCount })} icon={<Users />}>
        <div className="space-inspector-list">
          {space.occupancy.occupants.map((occupant) => (
            <div key={occupant.membershipId} className="space-inspector-list-row">
              <div>
                <strong>{occupant.fullName}</strong>
                <span>{occupant.role === "RESPONSIBLE" ? t("rental.responsible") : t("rental.additional")}</span>
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
  const t = useTranslations("building");
  const utilityStatusLabel = () => {
    if (!space.utilities.hasElectricityMeter) return t("inspector.noElectricityMeter");
    if (space.utilities.missingBoundary) return t("utilities.boundaryAttention");
    if (space.utilities.needsClosing) return t("utilities.monthlyClosingRequired");
    if (space.utilities.attentionCount) return t("utilities.utilityWarnings", { count: space.utilities.attentionCount });
    return t("utilities.healthy");
  };
  return (
    <div className="space-inspector-sections">
      <InspectorSection title={t("utilities.electricity")} icon={<Gauge />}>
        {space.utilities.hasElectricityMeter ? (
          <>
            <strong>{space.utilities.meterNumber || t("inspector.electricityMeter")}</strong>
            <dl className="space-inspector-inline-dl">
              <DetailLine label={t("utilities.latestReading")} value={space.utilities.latestReadingValue ?? "—"} />
              <DetailLine label={t("utilities.currentClosing")} value={space.utilities.monthlyClosingValue ?? "—"} />
              <DetailLine label={t("utilities.knownUsage")} value={space.utilities.knownUsageKwh ? `${space.utilities.knownUsageKwh} kWh` : "—"} />
              <DetailLine label={t("utilities.status")} value={utilityStatusLabel()} />
            </dl>
            <div className="space-inspector-actions">
              {space.utilities.activeMeterId && <MeterReadingDialog meterId={space.utilities.activeMeterId} />}
              <Button size="sm" variant="outline" asChild><a href={`/utilities/meters?space=${space.id}`}>{t("utilities.viewMeter")}</a></Button>
              <Button size="sm" variant="ghost" asChild><a href="/utilities">{t("utilities.openUtilities")}</a></Button>
            </div>
          </>
        ) : (
          <>
            <p className="space-inspector-muted">{t("utilities.meterNotLinked")}</p>
            <Button size="sm" variant="outline" asChild><a href={`/utilities/meters?space=${space.id}`}>{t("utilities.openMeters")}</a></Button>
          </>
        )}
      </InspectorSection>

      <InspectorSection title={t("utilities.water")} icon={<Gauge />}>
        {space.type === "ROOM" ? (
          <>
            <strong>{t("utilities.currentOccupants", { count: space.occupancy?.occupantCount ?? 0 })}</strong>
            <p>{t("utilities.fixedPerOccupant")}</p>
            <p className="space-inspector-muted">{t("utilities.billingOwnedElsewhere")}</p>
          </>
        ) : (
          <p className="space-inspector-muted">{t("utilities.noWaterSummary")}</p>
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
  const t = useTranslations("building");
  const locale = useLocale() as AppLocale;
  const enumLabel = (value: string) => {
    const key = enumStatusKey(value);
    return key ? t(`statusLabels.${key}`) : value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  };
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
      <InspectorSection title={t("operations.maintenance")} icon={<Wrench />}>
        <strong>{t("operations.activeIssues", { count: activeIssues.length })}</strong>
        <div className="space-inspector-list">
          {activeIssues.slice(0, 4).map((issue) => (
            <a key={issue.id} className="space-inspector-list-row is-link" href={`/operations/maintenance?space=${space.id}&issue=${issue.id}`}>
              <div><strong>{issue.title}</strong><span>{enumLabel(issue.priority)} · {enumLabel(issue.status)}</span></div>
            </a>
          ))}
          {!activeIssues.length && <p className="space-inspector-muted">{t("operations.noActiveIssues")}</p>}
        </div>
        <div className="space-inspector-actions">
          <MaintenanceFormDialog
            propertyId={propertyId}
            locations={data.maintenance.locations}
            assetOptions={data.maintenance.assetOptions}
            defaultFloorId={floor.id}
            defaultSpaceId={space.id}
            trigger={<Button size="sm"><Plus /> {t("operations.reportIssue")}</Button>}
          />
          <Button size="sm" variant="outline" asChild><a href={`/operations/maintenance?space=${space.id}`}>{t("operations.viewMaintenance")}</a></Button>
        </div>
      </InspectorSection>

      <InspectorSection title={t("operations.tasks")} icon={<ListTodo />}>
        <strong>{t("operations.upcomingCount", { count: tasks.length })}</strong>
        <div className="space-inspector-list">
          {tasks.slice(0, 4).map((task) => (
            <div key={task.id} className="space-inspector-list-row">
              <div><strong>{task.title}</strong><span>{task.dueDate ? formatDateOnlyLocale(task.dueDate, locale) : t("operations.noDueDate")}{task.overdue ? ` · ${t("operations.overdue")}` : ""}</span></div>
            </div>
          ))}
          {!tasks.length && <p className="space-inspector-muted">{t("operations.noLinkedTasks")}</p>}
        </div>
        <div className="space-inspector-actions">
          <TaskFormDialog
            propertyId={propertyId}
            locations={data.tasks.locations}
            maintenanceOptions={data.tasks.maintenanceOptions}
            invoiceOptions={data.tasks.invoiceOptions}
            defaultLinkedEntityType="SPACE"
            defaultLinkedEntityId={space.id}
            trigger={<Button size="sm"><Plus /> {t("operations.addTask")}</Button>}
          />
          <Button size="sm" variant="outline" asChild><a href="/operations/tasks">{t("operations.viewTasks")}</a></Button>
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
  const t = useTranslations("building");
  const enumLabel = (value: string) => {
    const key = enumStatusKey(value);
    return key ? t(`statusLabels.${key}`) : value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  };
  const assets = data.assets.items.filter((item) => item.spaceId === space.id && item.status !== "DISPOSED");
  const devices = data.devices.items.filter((item) => item.spaceId === space.id);
  const online = devices.filter((item) => item.status === "ONLINE").length;
  const unknown = devices.filter((item) => item.status === "UNKNOWN").length;

  return (
    <div className="space-inspector-sections">
      <InspectorSection title={t("assetsPanel.assets")} icon={<Boxes />}>
        <strong>{t("assetsPanel.activeCount", { count: assets.filter((item) => item.status === "ACTIVE").length })}</strong>
        <p>{t("assetsPanel.underMaintenance", { count: assets.filter((item) => item.underMaintenance).length })}</p>
        <div className="space-inspector-list">
          {assets.slice(0, 5).map((asset) => (
            <a key={asset.id} className="space-inspector-list-row is-link" href={`/assets/${asset.id}`}>
              <div><strong>{asset.name}</strong><span>{asset.categoryName} · {enumLabel(asset.status)}</span></div>
            </a>
          ))}
          {!assets.length && <p className="space-inspector-muted">{t("assetsPanel.noAssets")}</p>}
        </div>
        <div className="space-inspector-actions">
          <AssetFormDialog
            propertyId={propertyId}
            categories={data.assets.categories}
            locations={data.assets.locations}
            defaultFloorId={floor.id}
            defaultSpaceId={space.id}
            trigger={<Button size="sm"><Plus /> {t("assetsPanel.addAsset")}</Button>}
          />
          <Button size="sm" variant="outline" asChild><a href={`/assets?location=${space.id}`}>{t("assetsPanel.viewAssets")}</a></Button>
        </div>
      </InspectorSection>

      <InspectorSection title={t("assetsPanel.devices")} icon={<Wifi />}>
        <strong>{t("assetsPanel.registered", { count: devices.length })}</strong>
        <p>{t("assetsPanel.onlineUnknown", { online, unknown })}</p>
        <div className="space-inspector-list">
          {devices.slice(0, 5).map((device) => (
            <div key={device.id} className="space-inspector-list-row">
              <div><strong>{device.name}</strong><span>{device.deviceType} · {enumLabel(device.status)}</span></div>
            </div>
          ))}
          {!devices.length && <p className="space-inspector-muted">{t("assetsPanel.noDevices")}</p>}
        </div>
        <Button size="sm" variant="outline" asChild><a href="/assets/devices">{t("assetsPanel.viewDevices")}</a></Button>
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
  const t = useTranslations("building");
  return (
    <details className="space-inspector-manage">
      <summary>{t("management.title")}</summary>
      <div>
        <span className="space-inspector-management-meta">{t("management.displayOrder", { order: space.sortOrder })}</span>
        <SpaceFormDialog
          mode="edit"
          floor={floor}
          space={space}
          trigger={<Button size="sm" variant="outline"><Pencil /> {t("management.editSpace")}</Button>}
        />
        <SpaceReorderButton floorId={floor.id} spaceId={space.id} direction="up" label={t("management.moveLeft")} icon={<ArrowLeft />} />
        <SpaceReorderButton floorId={floor.id} spaceId={space.id} direction="down" label={t("management.moveRight")} icon={<ArrowRight />} />
        <ArchiveOrDeleteDialog
          entityName={space.name}
          description={t("management.archiveDeleteDescription")}
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
