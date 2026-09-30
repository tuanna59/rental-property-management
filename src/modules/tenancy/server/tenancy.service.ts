import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshDraftInvoicesForSpace } from "@/modules/billing/server/draft-refresh";
import { recordTenancyBoundaryInTransaction } from "@/modules/utilities/server/meter.service";
import { createPerson } from "@/modules/people/server/people.service";
import type { CreatePersonInput } from "@/modules/people/domain/types";
import { roundVnd } from "@/lib/money";

import { TenancyDomainError } from "../domain/errors";
import { assertMoveInRules, assertMoveOutRules } from "../domain/rules";
import type {
  AddOccupantInput,
  EndOccupancyInput,
  MoveInInput,
  MoveInOccupantInput,
  MoveAdditionalOccupantInput,
  MoveOutInput,
  NormalizedMoveInInput,
} from "../domain/types";
import {
  normalizeMoveInInput,
  normalizeMoveOutInput,
  normalizeBusinessDate,
} from "../domain/validation";
import { tenancyTransaction } from "./transaction";

type MoveInWithNewResponsibleInput = Omit<MoveInInput, "occupants"> & {
  person: CreatePersonInput;
  responsible: Omit<MoveInOccupantInput, "personId">;
  additionalPersonIds: string[];
};

type LockedPerson = { id: string; archivedAt: Date | null };

function hasExclusionViolation(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2039"
  ) {
    return false;
  }

  const meta = error.meta as
    { driverAdapterError?: { cause?: { code?: string } } } | undefined;
  return meta?.driverAdapterError?.cause?.code === "23P01";
}

function todayBusinessDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

async function lockAndValidatePeople(
  tx: Prisma.TransactionClient,
  personIds: string[],
) {
  const locked = await tx.$queryRaw<LockedPerson[]>(Prisma.sql`
    SELECT "id", "archivedAt"
    FROM "Person"
    WHERE "id" IN (${Prisma.join(personIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
  const byId = new Map(locked.map((person) => [person.id, person]));

  for (const personId of personIds) {
    const person = byId.get(personId);
    if (!person) {
      throw new TenancyDomainError(
        "PERSON_NOT_FOUND",
        "One or more selected people were not found.",
      );
    }
    if (person.archivedAt) {
      throw new TenancyDomainError(
        "PERSON_ARCHIVED",
        "Archived people cannot join a tenancy.",
      );
    }
  }
}

function periodOverlapWhere(startDate: Date, endDate: Date | null) {
  return {
    ...(endDate ? { startDate: { lt: endDate } } : {}),
    OR: [{ endDate: null }, { endDate: { gt: startDate } }],
  } satisfies Prisma.TenancyOccupantWhereInput;
}

async function assertPeopleHaveNoOverlap(
  tx: Prisma.TransactionClient,
  input: NormalizedMoveInInput,
) {
  const overlaps = await tx.tenancyOccupant.findFirst({
    where: {
      OR: input.occupants.map((occupant) => ({
        personId: occupant.personId,
        ...periodOverlapWhere(occupant.startDate, occupant.endDate),
      })),
    },
    select: { id: true },
  });
  if (overlaps) {
    throw new TenancyDomainError(
      "PERSON_OCCUPANCY_OVERLAP",
      "A selected person already occupies a room during this period.",
    );
  }
}

export async function moveIn(input: MoveInInput) {
  const normalized = normalizeMoveInInput(input);
  assertMoveInRules(normalized);
  const personIds = normalized.occupants
    .map((occupant) => occupant.personId)
    .sort((left, right) => left.localeCompare(right));

  const result = await tenancyTransaction(async (tx) => {
    await lockAndValidatePeople(tx, personIds);

    const space = await tx.space.findFirst({
      where: {
        id: normalized.spaceId,
        archivedAt: null,
        floor: { archivedAt: null, property: { archivedAt: null } },
      },
      select: { id: true, type: true },
    });
    if (!space) {
      throw new TenancyDomainError(
        "SPACE_NOT_FOUND",
        "The selected active space was not found.",
      );
    }
    if (space.type !== "ROOM") {
      throw new TenancyDomainError(
        "SPACE_NOT_ELIGIBLE",
        "Only active rental rooms can receive a tenancy.",
      );
    }

    const overlappingTenancy = await tx.tenancy.findFirst({
      where: {
        spaceId: normalized.spaceId,
        ...(normalized.moveOutDate
          ? { moveInDate: { lt: normalized.moveOutDate } }
          : {}),
        OR: [
          { moveOutDate: null },
          { moveOutDate: { gt: normalized.moveInDate } },
        ],
      },
      select: { id: true },
    });
    if (overlappingTenancy) {
      throw new TenancyDomainError(
        "TENANCY_OVERLAP",
        "The room already has a tenancy during this period.",
      );
    }

    await assertPeopleHaveNoOverlap(tx, normalized);

    let tenancy: { id: string };
    try {
      tenancy = await tx.tenancy.create({
        data: {
          spaceId: normalized.spaceId,
          moveInDate: normalized.moveInDate,
          moveOutDate: normalized.moveOutDate,
          monthlyRentVnd: normalized.monthlyRentVnd,
          depositVnd: normalized.depositVnd,
          moveInNotes: normalized.moveInNotes,
        },
        select: { id: true },
      });
    } catch (error) {
      if (hasExclusionViolation(error)) {
        throw new TenancyDomainError(
          "TENANCY_OVERLAP",
          "The room already has a tenancy during this period.",
        );
      }
      throw error;
    }

    try {
      await tx.tenancyOccupant.createMany({
        data: normalized.occupants.map((occupant) => ({
          tenancyId: tenancy.id,
          personId: occupant.personId,
          role: occupant.role,
          startDate: occupant.startDate,
          endDate: occupant.endDate,
          endedByTenancyMoveOut:
            normalized.moveOutDate !== null &&
            occupant.endDate?.getTime() === normalized.moveOutDate.getTime(),
          notes: occupant.notes,
        })),
      });
    } catch (error) {
      if (hasExclusionViolation(error)) {
        throw new TenancyDomainError(
          "PERSON_OCCUPANCY_OVERLAP",
          "A selected person already occupies a room during this period.",
        );
      }
      throw error;
    }

    await tx.tenancyRentRate.create({
      data: {
        tenancyId: tenancy.id,
        monthlyRentVnd: normalized.monthlyRentVnd,
        effectiveFrom: normalized.moveInDate,
        reason: "Initial rent",
      },
    });
    const responsible = await tx.tenancyOccupant.findFirstOrThrow({
      where: { tenancyId: tenancy.id, role: "RESPONSIBLE" },
      select: { id: true },
    });
    await tx.tenancyResponsibleAssignment.create({
      data: {
        tenancyId: tenancy.id,
        occupantId: responsible.id,
        effectiveFrom: normalized.moveInDate,
        reason: "Initial responsible renter",
      },
    });

    await recordTenancyBoundaryInTransaction(
      tx,
      normalized.spaceId,
      normalized.moveInDate,
      normalized.electricityReading ?? null,
      "MOVE_IN",
      normalized.electricityPhoto,
      normalized.moveInNotes,
    );
    return tenancy;
  });
  await refreshDraftInvoicesForSpace(normalized.spaceId);
  return result;
}

export async function changeRent(input: {
  tenancyId: string;
  monthlyRentVnd: string;
  effectiveFrom: string;
  reason: string;
}) {
  const effectiveFrom = normalizeBusinessDate(input.effectiveFrom);
  const today = todayBusinessDate();
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required.");
  if (effectiveFrom.getUTCDate() !== 1) {
    throw new Error(
      "The rent change must take effect on the first day of a month.",
    );
  }
  if (effectiveFrom < today) {
    throw new Error(
      "Rent changes can only take effect today or in the future.",
    );
  }
  const rounded = roundVnd(input.monthlyRentVnd);
  if (!rounded.isPositive()) throw new Error("Monthly rent must be positive.");

  const result = await tenancyTransaction(async (tx) => {
    const tenancy = await tx.tenancy.findUnique({
      where: { id: input.tenancyId },
      select: { spaceId: true, moveInDate: true, moveOutDate: true },
    });
    if (!tenancy) throw new Error("The tenancy was not found.");
    if (
      effectiveFrom < tenancy.moveInDate ||
      (tenancy.moveOutDate && effectiveFrom >= tenancy.moveOutDate)
    ) {
      throw new Error("The effective date must be inside the tenancy period.");
    }
    const rate = await tx.tenancyRentRate.create({
      data: {
        tenancyId: input.tenancyId,
        monthlyRentVnd: BigInt(rounded.toFixed(0)),
        effectiveFrom,
        reason,
      },
    });
    return { rate, spaceId: tenancy.spaceId };
  });
  await refreshDraftInvoicesForSpace(result.spaceId);
  return result.rate;
}

export async function changeResponsible(input: {
  tenancyId: string;
  occupantId: string;
  effectiveFrom: string;
  reason: string;
}) {
  const effectiveFrom = normalizeBusinessDate(input.effectiveFrom);
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required.");
  if (effectiveFrom < todayBusinessDate()) {
    throw new Error(
      "Responsibility changes can only take effect today or in the future.",
    );
  }
  return tenancyTransaction(async (tx) => {
    const tenancy = await tx.tenancy.findUnique({
      where: { id: input.tenancyId },
      select: { moveInDate: true, moveOutDate: true },
    });
    if (!tenancy) throw new Error("The tenancy was not found.");
    if (
      effectiveFrom < tenancy.moveInDate ||
      (tenancy.moveOutDate && effectiveFrom >= tenancy.moveOutDate)
    ) {
      throw new Error("The effective date must be inside the tenancy period.");
    }
    const occupant = await tx.tenancyOccupant.findFirst({
      where: {
        id: input.occupantId,
        tenancyId: input.tenancyId,
        startDate: { lte: effectiveFrom },
        OR: [{ endDate: null }, { endDate: { gt: effectiveFrom } }],
      },
      select: { id: true },
    });
    if (!occupant) {
      throw new Error(
        "The new responsible renter must be an active occupant of this tenancy.",
      );
    }
    return tx.tenancyResponsibleAssignment.create({
      data: {
        tenancyId: input.tenancyId,
        occupantId: occupant.id,
        effectiveFrom,
        reason,
      },
    });
  });
}

/** Creates an identity only when the move-in workflow successfully uses it. */
export async function moveInWithNewResponsible(
  input: MoveInWithNewResponsibleInput,
) {
  const created = await createPerson(input.person);
  try {
    return await moveIn({
      spaceId: input.spaceId,
      moveInDate: input.moveInDate,
      moveOutDate: input.moveOutDate,
      monthlyRentVnd: input.monthlyRentVnd,
      depositVnd: input.depositVnd,
      moveInNotes: input.moveInNotes,
      electricityReading: input.electricityReading,
      electricityPhoto: input.electricityPhoto,
      occupants: [
        { ...input.responsible, personId: created.id },
        ...input.additionalPersonIds.map((personId) => ({
          personId,
          role: "ADDITIONAL" as const,
          startDate: input.responsible.startDate,
          endDate: input.responsible.endDate,
        })),
      ],
    });
  } catch (error) {
    await prisma.person
      .delete({ where: { id: created.id } })
      .catch(() => undefined);
    throw error;
  }
}

export async function moveOut(input: MoveOutInput) {
  const normalized = normalizeMoveOutInput(input);

  const result = await tenancyTransaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "Tenancy"
      WHERE "id" = ${normalized.tenancyId}
      FOR UPDATE
    `);
    const tenancy = await tx.tenancy.findUnique({
      where: { id: normalized.tenancyId },
      select: {
        id: true,
        spaceId: true,
        moveInDate: true,
        moveOutDate: true,
        occupants: { select: { startDate: true } },
      },
    });
    if (!tenancy) {
      throw new TenancyDomainError(
        "TENANCY_NOT_FOUND",
        "The selected tenancy was not found.",
      );
    }
    if (tenancy.moveOutDate) {
      throw new TenancyDomainError(
        "TENANCY_ALREADY_CLOSED",
        "The selected tenancy is already closed.",
      );
    }

    assertMoveOutRules(
      tenancy.moveInDate,
      normalized.moveOutDate,
      tenancy.occupants.map((occupant) => occupant.startDate),
    );

    await tx.tenancy.update({
      where: { id: tenancy.id },
      data: {
        moveOutDate: normalized.moveOutDate,
        moveOutNotes: normalized.moveOutNotes ?? null,
      },
    });
    await tx.tenancyOccupant.updateMany({
      where: {
        tenancyId: tenancy.id,
        OR: [{ endDate: null }, { endDate: { gt: normalized.moveOutDate } }],
      },
      data: {
        endDate: normalized.moveOutDate,
        endedByTenancyMoveOut: true,
      },
    });

    await recordTenancyBoundaryInTransaction(
      tx,
      tenancy.spaceId,
      normalized.moveOutDate,
      normalized.electricityReading ?? null,
      "MOVE_OUT",
      normalized.electricityPhoto,
      normalized.moveOutNotes,
      normalized.electricityReadingSource,
      normalized.electricityReadingReason,
    );
    return { id: tenancy.id, spaceId: tenancy.spaceId };
  });
  await refreshDraftInvoicesForSpace(result.spaceId);
  return { id: result.id };
}

export async function addAdditionalOccupant(input: AddOccupantInput) {
  const startDate = normalizeBusinessDate(input.startDate);
  const result = await tenancyTransaction(async (tx) => {
    await lockAndValidatePeople(tx, [input.personId]);
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Tenancy" WHERE "id" = ${input.tenancyId} FOR UPDATE
    `);
    const tenancy = await tx.tenancy.findUnique({
      where: { id: input.tenancyId },
      select: { id: true, spaceId: true, moveInDate: true, moveOutDate: true },
    });
    if (!tenancy) {
      throw new TenancyDomainError(
        "TENANCY_NOT_FOUND",
        "The tenancy was not found.",
      );
    }
    const businessDate = todayBusinessDate();
    if (
      tenancy.moveInDate > businessDate ||
      (tenancy.moveOutDate && tenancy.moveOutDate <= businessDate)
    ) {
      throw new TenancyDomainError(
        "TENANCY_NOT_FOUND",
        "Additional occupants can only be added to a current tenancy.",
      );
    }
    if (
      startDate < tenancy.moveInDate ||
      (tenancy.moveOutDate && startDate >= tenancy.moveOutDate)
    ) {
      throw new TenancyDomainError(
        "INVALID_MEMBERSHIP_DATES",
        "The occupant start date must be inside the tenancy period.",
      );
    }
    const overlap = await tx.tenancyOccupant.findFirst({
      where: {
        personId: input.personId,
        ...periodOverlapWhere(startDate, tenancy.moveOutDate),
      },
      select: { id: true },
    });
    if (overlap) {
      throw new TenancyDomainError(
        "PERSON_OCCUPANCY_OVERLAP",
        "This person already occupies a room during that period.",
      );
    }
    try {
      const created = await tx.tenancyOccupant.create({
        data: {
          tenancyId: tenancy.id,
          personId: input.personId,
          role: "ADDITIONAL",
          startDate,
          endDate: tenancy.moveOutDate,
          endedByTenancyMoveOut: tenancy.moveOutDate !== null,
          notes: input.notes,
        },
        select: { id: true },
      });
      return { id: created.id, spaceId: tenancy.spaceId };
    } catch (error) {
      if (hasExclusionViolation(error)) {
        throw new TenancyDomainError(
          "PERSON_OCCUPANCY_OVERLAP",
          "This person already occupies a room during that period.",
        );
      }
      throw error;
    }
  });

  // Water billing is occupant-based, so an existing draft for this room must
  // be recalculated as soon as occupancy changes.
  await refreshDraftInvoicesForSpace(result.spaceId);
  return { id: result.id };
}

/** Keeps the optional "new person" path inside the occupancy command workflow. */
export async function addNewAdditionalOccupant(
  person: CreatePersonInput,
  occupancy: Omit<AddOccupantInput, "personId">,
) {
  const created = await createPerson(person);
  try {
    return await addAdditionalOccupant({ ...occupancy, personId: created.id });
  } catch (error) {
    await prisma.person
      .delete({ where: { id: created.id } })
      .catch(() => undefined);
    throw error;
  }
}

export async function endAdditionalOccupancy(input: EndOccupancyInput) {
  const endDate = normalizeBusinessDate(input.endDate);
  return tenancyTransaction(async (tx) => {
    const membership = await tx.tenancyOccupant.findUnique({
      where: { id: input.membershipId },
      select: {
        id: true,
        role: true,
        startDate: true,
        tenancy: { select: { moveOutDate: true } },
      },
    });
    if (!membership) {
      throw new TenancyDomainError(
        "OCCUPANT_NOT_FOUND",
        "The occupant record was not found.",
      );
    }
    if (membership.role === "RESPONSIBLE") {
      throw new TenancyDomainError(
        "RESPONSIBLE_CHANGE_UNSUPPORTED",
        "Change of responsible renter is not supported yet.",
      );
    }
    if (
      endDate <= membership.startDate ||
      (membership.tenancy.moveOutDate &&
        endDate > membership.tenancy.moveOutDate)
    ) {
      throw new TenancyDomainError(
        "INVALID_MEMBERSHIP_DATES",
        "The end date must be after the occupant start and inside the tenancy.",
      );
    }
    return tx.tenancyOccupant.update({
      where: { id: membership.id },
      data: {
        endDate,
        endedByTenancyMoveOut: false,
        ...(input.notes ? { notes: input.notes } : {}),
      },
      select: { id: true },
    });
  });
}

export async function moveAdditionalOccupant(
  input: MoveAdditionalOccupantInput,
) {
  const effectiveDate = normalizeBusinessDate(input.effectiveDate);
  return tenancyTransaction(async (tx) => {
    const source = await tx.tenancyOccupant.findUnique({
      where: { id: input.membershipId },
      select: {
        id: true,
        personId: true,
        role: true,
        startDate: true,
        endDate: true,
        tenancyId: true,
      },
    });
    if (!source) {
      throw new TenancyDomainError(
        "OCCUPANT_NOT_FOUND",
        "The occupant record was not found.",
      );
    }
    if (source.role === "RESPONSIBLE") {
      throw new TenancyDomainError(
        "RESPONSIBLE_CHANGE_UNSUPPORTED",
        "Change of responsible renter is not supported yet.",
      );
    }
    await lockAndValidatePeople(tx, [source.personId]);
    if (
      effectiveDate <= source.startDate ||
      (source.endDate && effectiveDate >= source.endDate)
    ) {
      throw new TenancyDomainError(
        "INVALID_MEMBERSHIP_DATES",
        "The move date must be inside the current participation period.",
      );
    }
    const destination = await tx.tenancy.findFirst({
      where: {
        spaceId: input.destinationSpaceId,
        moveInDate: { lte: effectiveDate },
        OR: [{ moveOutDate: null }, { moveOutDate: { gt: effectiveDate } }],
        space: {
          type: "ROOM",
          archivedAt: null,
          floor: { archivedAt: null, property: { archivedAt: null } },
        },
      },
      select: { id: true, moveOutDate: true },
    });
    if (!destination) {
      throw new TenancyDomainError(
        "DESTINATION_TENANCY_REQUIRED",
        "The destination is vacant. Start a new Move In flow for that room.",
      );
    }
    if (destination.id === source.tenancyId) {
      throw new TenancyDomainError(
        "INVALID_MEMBERSHIP_DATES",
        "Choose a different destination room.",
      );
    }
    const overlap = await tx.tenancyOccupant.findFirst({
      where: {
        personId: source.personId,
        id: { not: source.id },
        ...periodOverlapWhere(effectiveDate, destination.moveOutDate),
      },
      select: { id: true },
    });
    if (overlap) {
      throw new TenancyDomainError(
        "PERSON_OCCUPANCY_OVERLAP",
        "This person already occupies a room during that period.",
      );
    }
    await tx.tenancyOccupant.update({
      where: { id: source.id },
      data: { endDate: effectiveDate, endedByTenancyMoveOut: false },
    });
    const created = await tx.tenancyOccupant.create({
      data: {
        tenancyId: destination.id,
        personId: source.personId,
        role: "ADDITIONAL",
        startDate: effectiveDate,
        endDate: destination.moveOutDate,
        endedByTenancyMoveOut: destination.moveOutDate !== null,
      },
      select: { id: true },
    });
    return created;
  });
}

export async function cancelUpcomingMoveIn(
  tenancyId: string,
  businessDate: Date = todayBusinessDate(),
) {
  return tenancyTransaction(async (tx) => {
    const tenancy = await tx.tenancy.findUnique({
      where: { id: tenancyId },
      select: { id: true, moveInDate: true },
    });
    if (!tenancy)
      throw new TenancyDomainError(
        "TENANCY_NOT_FOUND",
        "The tenancy was not found.",
      );
    if (tenancy.moveInDate <= businessDate) {
      throw new TenancyDomainError(
        "UPCOMING_TENANCY_REQUIRED",
        "Only a future, never-started tenancy can be cancelled.",
      );
    }
    await tx.tenancyOccupant.deleteMany({ where: { tenancyId } });
    await tx.tenancy.delete({ where: { id: tenancyId } });
    return { id: tenancyId };
  });
}

export async function cancelScheduledMoveOut(
  tenancyId: string,
  businessDate: Date = todayBusinessDate(),
) {
  const result = await tenancyTransaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Tenancy" WHERE "id" = ${tenancyId} FOR UPDATE
    `);
    const tenancy = await tx.tenancy.findUnique({
      where: { id: tenancyId },
      select: {
        id: true,
        spaceId: true,
        moveInDate: true,
        moveOutDate: true,
        occupants: {
          where: { endedByTenancyMoveOut: true },
          select: { id: true, personId: true },
        },
      },
    });
    if (!tenancy)
      throw new TenancyDomainError(
        "TENANCY_NOT_FOUND",
        "The tenancy was not found.",
      );
    if (!tenancy.moveOutDate || tenancy.moveOutDate <= businessDate) {
      throw new TenancyDomainError(
        "SCHEDULED_MOVE_OUT_REQUIRED",
        "There is no future scheduled move-out to cancel.",
      );
    }
    const futureTenancy = await tx.tenancy.findFirst({
      where: {
        id: { not: tenancy.id },
        spaceId: tenancy.spaceId,
        OR: [
          { moveOutDate: null },
          { moveOutDate: { gt: tenancy.moveInDate } },
        ],
      },
      select: { id: true },
    });
    if (futureTenancy) {
      throw new TenancyDomainError(
        "TENANCY_OVERLAP",
        "Cancel the conflicting future move-in before reopening this tenancy.",
      );
    }
    if (tenancy.occupants.length) {
      const personConflict = await tx.tenancyOccupant.findFirst({
        where: {
          tenancyId: { not: tenancy.id },
          personId: { in: tenancy.occupants.map((item) => item.personId) },
          OR: [{ endDate: null }, { endDate: { gt: tenancy.moveOutDate } }],
        },
        select: { id: true },
      });
      if (personConflict) {
        throw new TenancyDomainError(
          "PERSON_OCCUPANCY_OVERLAP",
          "A renter has another scheduled occupancy after this move-out.",
        );
      }
    }
    await tx.tenancy.update({
      where: { id: tenancy.id },
      data: { moveOutDate: null, moveOutNotes: null },
    });
    await tx.tenancyOccupant.updateMany({
      where: { tenancyId: tenancy.id, endedByTenancyMoveOut: true },
      data: { endDate: null, endedByTenancyMoveOut: false },
    });
    return { id: tenancy.id, spaceId: tenancy.spaceId };
  });
  await refreshDraftInvoicesForSpace(result.spaceId);
  return { id: result.id };
}
