import { prisma } from "@/lib/prisma";

import type { PersonRecord } from "../domain/types";
import { projectRentalState } from "../domain/rental-state";
import { citizenIdLookupHash, decryptCitizenId } from "./citizen-id";

const personSelect = {
  id: true,
  fullName: true,
  phone: true,
  phoneNormalized: true,
  dateOfBirth: true,
  citizenIdEncrypted: true,
  citizenIdLast4: true,
  avatarStorageKey: true,
  citizenIdFrontKey: true,
  citizenIdBackKey: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
} as const;

function toPersonRecord(person: {
  id: string;
  fullName: string;
  phone: string | null;
  phoneNormalized: string | null;
  dateOfBirth: Date | null;
  citizenIdEncrypted: string | null;
  citizenIdLast4: string | null;
  avatarStorageKey: string | null;
  citizenIdFrontKey: string | null;
  citizenIdBackKey: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): PersonRecord {
  const {
    citizenIdEncrypted,
    avatarStorageKey,
    citizenIdFrontKey,
    citizenIdBackKey,
    ...safePerson
  } = person;
  return {
    ...safePerson,
    hasCitizenId: citizenIdEncrypted !== null,
    hasAvatar: avatarStorageKey !== null,
    hasCitizenIdFront: citizenIdFrontKey !== null,
    hasCitizenIdBack: citizenIdBackKey !== null,
  };
}

function currentBusinessDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function getPeopleDirectory(search = "") {
  const date = currentBusinessDate();
  const people = await prisma.person.findMany({
    where: search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ archivedAt: "asc" }, { fullName: "asc" }],
    select: {
      ...personSelect,
      tenancyOccupancies: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          role: true,
          startDate: true,
          endDate: true,
          tenancy: {
            select: {
              id: true,
              moveInDate: true,
              moveOutDate: true,
              space: {
                select: {
                  id: true,
                  name: true,
                  floor: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return people.map((person) => {
    const { tenancyOccupancies, ...personFields } = person;
    const safe = toPersonRecord(personFields);
    const history = tenancyOccupancies.map((membership) => ({
      membershipId: membership.id,
      tenancyId: membership.tenancy.id,
      role: membership.role,
      startDate: membership.startDate,
      endDate: membership.endDate,
      moveInDate: membership.tenancy.moveInDate,
      moveOutDate: membership.tenancy.moveOutDate,
      spaceId: membership.tenancy.space.id,
      spaceName: membership.tenancy.space.name,
      floorName: membership.tenancy.space.floor.name,
    }));
    const projection = projectRentalState(history, date);
    const match = (period: (typeof history)[number]) =>
      history.find((item) => item.membershipId === period.membershipId) ?? null;
    return {
      ...safe,
      rentalState: projection.state,
      currentTenancy: projection.current ? match(projection.current) : null,
      upcomingTenancy: projection.upcoming ? match(projection.upcoming) : null,
      lastTenancy: history[0] ?? null,
      rentalHistory: history,
    };
  });
}

export async function getPersonById(
  personId: string,
  options: { includeArchived?: boolean } = {},
) {
  const person = await prisma.person.findFirst({
    where: {
      id: personId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    select: personSelect,
  });
  return person ? toPersonRecord(person) : null;
}

export async function findPersonByCitizenId(
  citizenId: string,
  options: { includeArchived?: boolean } = {},
) {
  const person = await prisma.person.findFirst({
    where: {
      citizenIdLookupHash: citizenIdLookupHash(citizenId),
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    select: personSelect,
  });
  return person ? toPersonRecord(person) : null;
}

export async function revealPersonCitizenId(personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { citizenIdEncrypted: true },
  });
  if (!person?.citizenIdEncrypted) return null;
  return decryptCitizenId(person.citizenIdEncrypted);
}
