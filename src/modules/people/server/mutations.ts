import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  normalizeVietnamesePhone,
  PeopleDomainError,
} from "../domain/identity";
import type { CreatePersonInput, UpdatePersonInput } from "../domain/types";
import {
  archivePersonSchema,
  createPersonSchema,
  updatePersonSchema,
} from "../domain/validation";
import { protectCitizenId } from "./citizen-id";

function citizenIdConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function throwSafeMutationError(error: unknown): never {
  if (
    error instanceof Error &&
    error.message === "Citizen ID protection keys are not configured correctly."
  ) {
    throw new PeopleDomainError(
      "Citizen ID storage is not configured. Leave it blank or configure the protection keys.",
    );
  }
  if (citizenIdConflict(error)) {
    throw new PeopleDomainError(
      "A person with this citizen ID already exists.",
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new PeopleDomainError("The selected person was not found.");
  }
  throw error;
}

export async function createPerson(input: CreatePersonInput) {
  const parsed = createPersonSchema.parse(input);
  const citizenIdData = parsed.citizenId
    ? protectCitizenId(parsed.citizenId)
    : {};

  try {
    return await prisma.person.create({
      data: {
        fullName: parsed.fullName,
        phone: parsed.phone,
        phoneNormalized: parsed.phone
          ? normalizeVietnamesePhone(parsed.phone)
          : null,
        dateOfBirth: parsed.dateOfBirth,
        notes: parsed.notes,
        ...citizenIdData,
      },
      select: { id: true },
    });
  } catch (error) {
    throwSafeMutationError(error);
  }
}

export async function updatePerson(input: UpdatePersonInput) {
  const parsed = updatePersonSchema.parse(input);
  const citizenIdData = parsed.citizenId
    ? protectCitizenId(parsed.citizenId)
    : {};

  try {
    return await prisma.person.update({
      where: { id: parsed.personId, archivedAt: null },
      data: {
        fullName: parsed.fullName,
        phone: parsed.phone ?? null,
        phoneNormalized: parsed.phone
          ? normalizeVietnamesePhone(parsed.phone)
          : null,
        dateOfBirth: parsed.dateOfBirth ?? null,
        notes: parsed.notes ?? null,
        ...citizenIdData,
      },
      select: { id: true },
    });
  } catch (error) {
    throwSafeMutationError(error);
  }
}

export async function archivePerson(input: { personId: string }) {
  const parsed = archivePersonSchema.parse(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const businessDate = new Date(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
      );
      const activeOrUpcomingOccupancy = await tx.tenancyOccupant.count({
        where: {
          personId: parsed.personId,
          OR: [{ endDate: null }, { endDate: { gt: businessDate } }],
          tenancy: {
            OR: [{ moveOutDate: null }, { moveOutDate: { gt: businessDate } }],
          },
        },
      });
      if (activeOrUpcomingOccupancy > 0) {
        throw new PeopleDomainError(
          "Current or upcoming renters cannot be archived. End or cancel their occupancy first.",
        );
      }
      return tx.person.update({
        where: { id: parsed.personId, archivedAt: null },
        data: { archivedAt: new Date() },
        select: { id: true },
      });
    });
  } catch (error) {
    throwSafeMutationError(error);
  }
}

export async function restorePerson(input: { personId: string }) {
  const parsed = archivePersonSchema.parse(input);
  try {
    return await prisma.person.update({
      where: { id: parsed.personId, archivedAt: { not: null } },
      data: { archivedAt: null },
      select: { id: true },
    });
  } catch (error) {
    throwSafeMutationError(error);
  }
}
