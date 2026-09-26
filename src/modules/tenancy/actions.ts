"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { createPerson } from "@/modules/people/server/mutations";
import { PeopleDomainError } from "@/modules/people/domain/identity";
import { prisma } from "@/lib/prisma";

import { TenancyDomainError } from "./domain/errors";
import {
  addAdditionalOccupant,
  cancelScheduledMoveOut,
  cancelUpcomingMoveIn,
  endAdditionalOccupancy,
  moveAdditionalOccupant,
  moveIn,
  moveOut,
} from "./server/services";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function moveInAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdPersonId: string | null = null;
  try {
    let responsiblePersonId = value(formData, "responsiblePersonId");
    if (responsiblePersonId === "__new") {
      const created = await createPerson({
        fullName: value(formData, "newPersonName"),
        phone: value(formData, "newPersonPhone") || undefined,
        citizenId: value(formData, "newPersonCitizenId") || undefined,
      });
      responsiblePersonId = created.id;
      createdPersonId = created.id;
    }
    const moveOutDate = value(formData, "moveOutDate") || null;
    const startDate = value(formData, "moveInDate");
    const occupants = [
      {
        personId: responsiblePersonId,
        role: "RESPONSIBLE" as const,
        startDate,
        endDate: moveOutDate,
      },
      ...formData.getAll("additionalPersonIds").map((personId) => ({
        personId: String(personId),
        role: "ADDITIONAL" as const,
        startDate,
        endDate: moveOutDate,
      })),
    ];
    await moveIn({
      spaceId: value(formData, "spaceId"),
      moveInDate: startDate,
      moveOutDate,
      monthlyRentVnd: value(formData, "monthlyRentVnd"),
      depositVnd: value(formData, "depositVnd") || null,
      moveInNotes: value(formData, "moveInNotes") || undefined,
      occupants,
    });
    revalidatePath("/");
    revalidatePath("/tenants");
    return { ok: true, message: "Move-in recorded." };
  } catch (error) {
    if (createdPersonId) {
      await prisma.person
        .delete({ where: { id: createdPersonId } })
        .catch(() => undefined);
    }
    if (
      error instanceof TenancyDomainError ||
      error instanceof PeopleDomainError
    ) {
      return { ok: false, message: error.message };
    }
    console.error(error);
    return { ok: false, message: "Move-in could not be recorded." };
  }
}

export async function moveOutAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await moveOut({
      tenancyId: value(formData, "tenancyId"),
      moveOutDate: value(formData, "moveOutDate"),
      moveOutNotes: value(formData, "moveOutNotes") || undefined,
    });
    revalidatePath("/");
    revalidatePath("/tenants");
    return { ok: true, message: "Move-out recorded." };
  } catch (error) {
    if (error instanceof TenancyDomainError) {
      return { ok: false, message: error.message };
    }
    console.error(error);
    return { ok: false, message: "Move-out could not be recorded." };
  }
}

async function tenancyAction(
  work: () => Promise<unknown>,
  success: string,
): Promise<ActionState> {
  try {
    await work();
    revalidatePath("/");
    revalidatePath("/tenants");
    return { ok: true, message: success };
  } catch (error) {
    if (
      error instanceof TenancyDomainError ||
      error instanceof PeopleDomainError
    ) {
      return { ok: false, message: error.message };
    }
    console.error(error);
    return { ok: false, message: "The rental change could not be saved." };
  }
}

export async function addOccupantAction(
  _state: ActionState,
  formData: FormData,
) {
  let createdPersonId: string | null = null;
  return tenancyAction(async () => {
    let personId = value(formData, "personId");
    if (personId === "__new") {
      const created = await createPerson({
        fullName: value(formData, "newPersonName"),
        phone: value(formData, "newPersonPhone") || undefined,
      });
      personId = created.id;
      createdPersonId = created.id;
    }
    try {
      await addAdditionalOccupant({
        tenancyId: value(formData, "tenancyId"),
        personId,
        startDate: value(formData, "startDate"),
        notes: value(formData, "notes") || undefined,
      });
    } catch (error) {
      if (createdPersonId) {
        await prisma.person
          .delete({ where: { id: createdPersonId } })
          .catch(() => undefined);
      }
      throw error;
    }
  }, "Occupant added.");
}

export async function endOccupancyAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () =>
      endAdditionalOccupancy({
        membershipId: value(formData, "membershipId"),
        endDate: value(formData, "endDate"),
        notes: value(formData, "notes") || undefined,
      }),
    "Occupancy ended.",
  );
}

export async function moveOccupantAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () =>
      moveAdditionalOccupant({
        membershipId: value(formData, "membershipId"),
        destinationSpaceId: value(formData, "destinationSpaceId"),
        effectiveDate: value(formData, "effectiveDate"),
      }),
    "Occupant moved.",
  );
}

export async function cancelUpcomingMoveInAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () => cancelUpcomingMoveIn(value(formData, "tenancyId")),
    "Scheduled move-in cancelled.",
  );
}

export async function cancelScheduledMoveOutAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () => cancelScheduledMoveOut(value(formData, "tenancyId")),
    "Scheduled move-out cancelled.",
  );
}
