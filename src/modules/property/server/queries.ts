import { prisma } from "@/lib/prisma";

import type { DashboardProperty } from "../domain/types";

export async function getPrimaryPropertyDashboard(): Promise<DashboardProperty | null> {
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
      })),
    })),
  };
}
