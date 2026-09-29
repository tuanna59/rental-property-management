import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/presentation";
import { getSpaceAssetSummaries } from "@/modules/assets/server/assets.queries";
import { getBuildingMaintenanceSignals } from "@/modules/operations/server/operations.queries";
import {
  getCurrentOccupancyBySpaceIds,
  getUpcomingOccupancyBySpaceIds,
} from "@/modules/tenancy/server/tenancy.queries";
import { getMonthlyMeterEntries } from "@/modules/utilities/server/utility.queries";

import type {
  BuildingVisualProjection,
  BuildingVisualSpaceProjection,
  DashboardProperty,
  PropertyShellProjection,
} from "../domain/types";

/** True once any Property record exists. Used by the first-run bootstrap guard. */
export async function hasExistingProperty(): Promise<boolean> {
  const property = await prisma.property.findFirst({ select: { id: true } });
  return Boolean(property);
}

/** Lightweight property projection used by the shared application shell. */
export async function getPrimaryPropertyShell(): Promise<PropertyShellProjection | null> {
  return prisma.property.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      addressLine1: true,
      city: true,
      country: true,
    },
  });
}

async function getPrimaryPropertyRecord() {
  return prisma.property.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      floors: {
        where: { archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          spaces: {
            where: { archivedAt: null },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
}

/** Existing lightweight dashboard projection used by non-Building modules. */
export async function getPrimaryPropertyDashboard(): Promise<DashboardProperty | null> {
  const property = await getPrimaryPropertyRecord();
  if (!property) return null;

  const spaceIds = property.floors.flatMap((floor) =>
    floor.spaces.map((space) => space.id),
  );
  const businessDate = todayBusinessDate();
  const [occupancy, upcomingOccupancy] = await Promise.all([
    getCurrentOccupancyBySpaceIds(spaceIds, businessDate),
    getUpcomingOccupancyBySpaceIds(spaceIds, businessDate),
  ]);

  return {
    id: property.id,
    name: property.name,
    description: property.description,
    addressLine1: property.addressLine1,
    city: property.city,
    country: property.country,
    floors: property.floors.map((floor) => ({
      id: floor.id,
      propertyId: floor.propertyId,
      name: floor.name,
      level: floor.level,
      sortOrder: floor.sortOrder,
      notes: floor.notes,
      spaces: floor.spaces.map((space) => ({
        id: space.id,
        floorId: space.floorId,
        name: space.name,
        type: space.type,
        sortOrder: space.sortOrder,
        notes: space.notes,
        occupancy: toDashboardOccupancy(occupancy.get(space.id)),
        upcomingOccupancy: toDashboardOccupancy(upcomingOccupancy.get(space.id)),
      })),
    })),
  };
}

/**
 * Phase 8's single coherent read projection. It composes existing domain
 * projections server-side so the renderer remains purely presentational.
 */
export async function getBuildingVisualProjection(): Promise<BuildingVisualProjection | null> {
  const property = await getPrimaryPropertyRecord();
  if (!property) return null;

  const spaceIds = property.floors.flatMap((floor) =>
    floor.spaces.map((space) => space.id),
  );
  const businessDate = todayBusinessDate();
  const currentMonth = `${businessDate.getUTCFullYear()}-${String(
    businessDate.getUTCMonth() + 1,
  ).padStart(2, "0")}`;

  const [occupancy, upcomingOccupancy, utilityEntries, maintenance, assets] =
    await Promise.all([
      getCurrentOccupancyBySpaceIds(spaceIds, businessDate),
      getUpcomingOccupancyBySpaceIds(spaceIds, businessDate),
      getMonthlyMeterEntries(property.id, `${currentMonth}-01`),
      getBuildingMaintenanceSignals(property.id),
      getSpaceAssetSummaries(property.id),
    ]);

  const utilityBySpace = new Map(
    utilityEntries.map((entry) => [entry.spaceId, entry] as const),
  );
  const maintenanceBySpace = new Map(
    maintenance.map((item) => [item.spaceId, item] as const),
  );
  const assetBySpace = new Map(
    assets.map((item) => [item.spaceId, item] as const),
  );

  return {
    id: property.id,
    name: property.name,
    description: property.description,
    addressLine1: property.addressLine1,
    city: property.city,
    country: property.country,
    floors: property.floors.map((floor) => ({
      id: floor.id,
      propertyId: floor.propertyId,
      name: floor.name,
      level: floor.level,
      sortOrder: floor.sortOrder,
      notes: floor.notes,
      spaces: floor.spaces.map((space): BuildingVisualSpaceProjection => {
        const current = toDashboardOccupancy(occupancy.get(space.id));
        const upcoming = toDashboardOccupancy(upcomingOccupancy.get(space.id));
        const utility = utilityBySpace.get(space.id);
        const issue = maintenanceBySpace.get(space.id);
        const inventory = assetBySpace.get(space.id);
        const isRental = space.type === "ROOM";
        return {
          id: space.id,
          floorId: space.floorId,
          name: space.name,
          type: space.type,
          sortOrder: space.sortOrder,
          notes: space.notes,
          occupancy: current,
          upcomingOccupancy: upcoming,
          occupancyState: !isRental
            ? "NON_RENTAL"
            : current
              ? "OCCUPIED"
              : upcoming
                ? "UPCOMING"
                : "VACANT",
          currentResponsiblePerson: current?.responsible?.fullName ?? null,
          utilities: {
            meterCount: utility?.history?.length ?? 0,
            hasElectricityMeter: Boolean(utility?.activeMeter),
            needsClosing: utility?.closingStatus === "NEEDS_CLOSING",
            missingBoundary: Boolean(utility?.missingBoundary?.length),
            attentionCount: utility?.warnings?.length ?? 0,
            activeMeterId: utility?.activeMeter?.id ?? null,
            meterNumber: utility?.activeMeter?.meterNumber ?? null,
            latestReadingValue: utility?.latestReading?.readingValue ?? null,
            monthlyClosingValue: utility?.monthlyReading?.readingValue ?? null,
            knownUsageKwh: utility?.knownPhysicalUsage ?? null,
          },
          maintenance: {
            openCount: issue?.openCount ?? 0,
            inProgressCount: issue?.inProgressCount ?? 0,
            urgentCount: issue?.urgentCount ?? 0,
          },
          assets: {
            activeCount: inventory?.activeAssetCount ?? 0,
            underMaintenanceCount: inventory?.maintenanceAssetCount ?? 0,
          },
          devices: {
            totalCount: inventory?.deviceCount ?? 0,
            offlineCount: inventory?.offlineDeviceCount ?? 0,
          },
        };
      }),
    })),
  };
}

function todayBusinessDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function toDashboardOccupancy(
  occupancy: Awaited<
    ReturnType<typeof getCurrentOccupancyBySpaceIds>
  > extends Map<string, infer TValue>
    ? TValue | undefined
    : never,
) {
  if (!occupancy) return null;
  const date = (value: Date | null) => (value ? toDateOnly(value) : null);
  return {
    tenancyId: occupancy.tenancyId,
    moveInDate: date(occupancy.moveInDate)!,
    moveOutDate: date(occupancy.moveOutDate),
    monthlyRentVnd: occupancy.monthlyRentVnd.toString(),
    depositVnd: occupancy.depositVnd?.toString() ?? null,
    moveInNotes: occupancy.moveInNotes,
    occupantCount: occupancy.occupantCount,
    responsible: occupancy.responsible
      ? {
          personId: occupancy.responsible.personId,
          fullName: occupancy.responsible.fullName,
        }
      : null,
    occupants: occupancy.occupants.map((occupant) => ({
      membershipId: occupant.membershipId,
      personId: occupant.personId,
      fullName: occupant.fullName,
      role: occupant.role,
      startDate: date(occupant.startDate)!,
      endDate: date(occupant.endDate),
    })),
  };
}

export async function getActivePersonOptions() {
  return prisma.person.findMany({
    where: { archivedAt: null },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
}
