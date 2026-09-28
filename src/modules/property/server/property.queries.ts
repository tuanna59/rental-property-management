import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/presentation";
import {
  getCurrentOccupancyBySpaceIds,
  getUpcomingOccupancyBySpaceIds,
} from "@/modules/tenancy/server/tenancy.queries";

import type { BuildingProjection, PropertyShellProjection } from "../domain/types";


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

/** Builds the read model consumed by the interactive building and space overview. */
export async function getPrimaryPropertyDashboard(): Promise<BuildingProjection | null> {
  const property = await prisma.property.findFirst({
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

  if (!property) {
    return null;
  }

  const spaceIds = property.floors.flatMap((floor) =>
    floor.spaces.map((space) => space.id),
  );
  const now = new Date();
  const businessDate = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
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
        upcomingOccupancy: toDashboardOccupancy(
          upcomingOccupancy.get(space.id),
        ),
      })),
    })),
  };
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
