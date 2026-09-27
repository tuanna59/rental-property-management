import { prisma } from "@/lib/prisma";

import type { ActiveOccupant, SpaceOccupancy } from "../domain/types";
import { normalizeBusinessDate } from "../domain/validation";

function activeAt(businessDate: Date) {
  return {
    startDate: { lte: businessDate },
    OR: [{ endDate: null }, { endDate: { gt: businessDate } }],
  };
}

function toActiveOccupant(occupant: {
  id: string;
  personId: string;
  role: "RESPONSIBLE" | "ADDITIONAL";
  startDate: Date;
  endDate: Date | null;
  person: { fullName: string };
}): ActiveOccupant {
  return {
    membershipId: occupant.id,
    personId: occupant.personId,
    fullName: occupant.person.fullName,
    role: occupant.role,
    startDate: occupant.startDate,
    endDate: occupant.endDate,
  };
}

export async function getCurrentOccupancyBySpaceIds(
  spaceIds: string[],
  date: string | Date,
) {
  if (spaceIds.length === 0) return new Map<string, SpaceOccupancy>();
  const businessDate = normalizeBusinessDate(date);
  const tenancies = await prisma.tenancy.findMany({
    where: {
      spaceId: { in: spaceIds },
      moveInDate: { lte: businessDate },
      OR: [{ moveOutDate: null }, { moveOutDate: { gt: businessDate } }],
    },
    select: {
      id: true,
      spaceId: true,
      moveInDate: true,
      moveOutDate: true,
      monthlyRentVnd: true,
      depositVnd: true,
      moveInNotes: true,
      moveOutNotes: true,
      occupants: {
        where: activeAt(businessDate),
        orderBy: [{ role: "desc" }, { startDate: "asc" }, { id: "asc" }],
        select: {
          id: true,
          personId: true,
          role: true,
          startDate: true,
          endDate: true,
          person: { select: { fullName: true } },
        },
      },
    },
  });

  return new Map(
    tenancies.map((tenancy) => {
      const occupants = tenancy.occupants.map(toActiveOccupant);
      return [
        tenancy.spaceId,
        {
          spaceId: tenancy.spaceId,
          tenancyId: tenancy.id,
          moveInDate: tenancy.moveInDate,
          moveOutDate: tenancy.moveOutDate,
          monthlyRentVnd: tenancy.monthlyRentVnd,
          depositVnd: tenancy.depositVnd,
          moveInNotes: tenancy.moveInNotes,
          moveOutNotes: tenancy.moveOutNotes,
          occupants,
          occupantCount: occupants.length,
          responsible:
            occupants.find((occupant) => occupant.role === "RESPONSIBLE") ??
            null,
        },
      ];
    }),
  );
}

export async function getCurrentTenancyForSpace(
  spaceId: string,
  date: string | Date,
) {
  return (
    (await getCurrentOccupancyBySpaceIds([spaceId], date)).get(spaceId) ?? null
  );
}

export async function getUpcomingOccupancyBySpaceIds(
  spaceIds: string[],
  date: string | Date,
) {
  if (spaceIds.length === 0) return new Map<string, SpaceOccupancy>();
  const businessDate = normalizeBusinessDate(date);
  const tenancies = await prisma.tenancy.findMany({
    where: { spaceId: { in: spaceIds }, moveInDate: { gt: businessDate } },
    orderBy: { moveInDate: "asc" },
    select: {
      id: true,
      spaceId: true,
      moveInDate: true,
      moveOutDate: true,
      monthlyRentVnd: true,
      depositVnd: true,
      moveInNotes: true,
      moveOutNotes: true,
      occupants: {
        orderBy: [{ role: "desc" }, { startDate: "asc" }],
        select: {
          id: true,
          personId: true,
          role: true,
          startDate: true,
          endDate: true,
          person: { select: { fullName: true } },
        },
      },
    },
  });
  const result = new Map<string, SpaceOccupancy>();
  for (const tenancy of tenancies) {
    if (result.has(tenancy.spaceId)) continue;
    const occupants = tenancy.occupants
      .filter(
        (occupant) =>
          occupant.startDate <= tenancy.moveInDate &&
          (!occupant.endDate || occupant.endDate > tenancy.moveInDate),
      )
      .map(toActiveOccupant);
    result.set(tenancy.spaceId, {
      spaceId: tenancy.spaceId,
      tenancyId: tenancy.id,
      moveInDate: tenancy.moveInDate,
      moveOutDate: tenancy.moveOutDate,
      monthlyRentVnd: tenancy.monthlyRentVnd,
      depositVnd: tenancy.depositVnd,
      moveInNotes: tenancy.moveInNotes,
      moveOutNotes: tenancy.moveOutNotes,
      occupants,
      occupantCount: occupants.length,
      responsible:
        occupants.find((occupant) => occupant.role === "RESPONSIBLE") ?? null,
    });
  }
  return result;
}

export async function getActiveOccupantsForTenancy(
  tenancyId: string,
  date: string | Date,
) {
  const businessDate = normalizeBusinessDate(date);
  const occupants = await prisma.tenancyOccupant.findMany({
    where: { tenancyId, ...activeAt(businessDate) },
    orderBy: [{ role: "desc" }, { startDate: "asc" }, { id: "asc" }],
    select: {
      id: true,
      personId: true,
      role: true,
      startDate: true,
      endDate: true,
      person: { select: { fullName: true } },
    },
  });
  return occupants.map(toActiveOccupant);
}

export async function countActiveOccupantsForTenancy(
  tenancyId: string,
  date: string | Date,
) {
  const businessDate = normalizeBusinessDate(date);
  return prisma.tenancyOccupant.count({
    where: { tenancyId, ...activeAt(businessDate) },
  });
}

export async function getCurrentResponsiblePerson(
  tenancyId: string,
  date: string | Date,
) {
  const businessDate = normalizeBusinessDate(date);
  const occupant = await prisma.tenancyOccupant.findFirst({
    where: {
      tenancyId,
      role: "RESPONSIBLE",
      ...activeAt(businessDate),
    },
    select: {
      id: true,
      personId: true,
      role: true,
      startDate: true,
      endDate: true,
      person: { select: { fullName: true } },
    },
  });
  return occupant ? toActiveOccupant(occupant) : null;
}
