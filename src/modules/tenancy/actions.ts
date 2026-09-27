"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { PeopleDomainError } from "@/modules/people/domain/identity";

import { TenancyDomainError } from "./domain/errors";
import {
  addAdditionalOccupant,
  addNewAdditionalOccupant,
  cancelScheduledMoveOut,
  cancelUpcomingMoveIn,
  endAdditionalOccupancy,
  moveAdditionalOccupant,
  moveIn,
  moveInWithNewResponsible,
  moveOut,
} from "./server/tenancy.service";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function moveInAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const moveOutDate = value(formData, "moveOutDate") || null;
    const startDate = value(formData, "moveInDate");
    const baseInput = {
      spaceId: value(formData, "spaceId"),
      moveInDate: startDate,
      moveOutDate,
      monthlyRentVnd: value(formData, "monthlyRentVnd"),
      depositVnd: value(formData, "depositVnd") || null,
      moveInNotes: value(formData, "moveInNotes") || undefined,
    };
    const responsiblePersonId = value(formData, "responsiblePersonId");
    if (responsiblePersonId === "__new") {
      await moveInWithNewResponsible({
        ...baseInput,
        person: {
          fullName: value(formData, "newPersonName"),
          phone: value(formData, "newPersonPhone") || undefined,
          citizenId: value(formData, "newPersonCitizenId") || undefined,
        },
        responsible: { role: "RESPONSIBLE", startDate, endDate: moveOutDate },
        additionalPersonIds: formData.getAll("additionalPersonIds").map(String),
      });
    } else {
      await moveIn({
        ...baseInput,
        occupants: [
          {
            personId: responsiblePersonId,
            role: "RESPONSIBLE",
            startDate,
            endDate: moveOutDate,
          },
          ...formData
            .getAll("additionalPersonIds")
            .map((personId) => ({
              personId: String(personId),
              role: "ADDITIONAL" as const,
              startDate,
              endDate: moveOutDate,
            })),
        ],
      });
    }
    revalidatePath("/");
    revalidatePath("/tenants");
    return { ok: true, message: "Move-in recorded." };
  } catch (error) {
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
  return tenancyAction(async () => {
    const occupancy = {
      tenancyId: value(formData, "tenancyId"),
      startDate: value(formData, "startDate"),
      notes: value(formData, "notes") || undefined,
    };
    const personId = value(formData, "personId");
    if (personId === "__new") {
      await addNewAdditionalOccupant(
        {
          fullName: value(formData, "newPersonName"),
          phone: value(formData, "newPersonPhone") || undefined,
        },
        occupancy,
      );
    } else {
      await addAdditionalOccupant({
        ...occupancy,
        personId,
      });
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
