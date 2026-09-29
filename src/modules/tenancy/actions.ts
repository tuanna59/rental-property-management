"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { getActionFeedback } from "@/i18n/action-feedback";
import { PeopleDomainError } from "@/modules/people/domain/identity";
import {
  localizePeopleDomainError,
  localizePersonValidationError,
  parseNewPersonForAction,
} from "@/modules/people/action-feedback";

import { TenancyDomainError } from "./domain/errors";
import { localizeTenancyError } from "./action-feedback";
import {
  addAdditionalOccupant,
  addNewAdditionalOccupant,
  cancelScheduledMoveOut,
  cancelUpcomingMoveIn,
  changeRent,
  changeResponsible,
  endAdditionalOccupancy,
  moveAdditionalOccupant,
  moveIn,
  moveInWithNewResponsible,
  moveOut,
} from "./server/tenancy.service";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function changeRentAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () =>
      changeRent({
        tenancyId: value(formData, "tenancyId"),
        monthlyRentVnd: value(formData, "monthlyRentVnd"),
        effectiveFrom: value(formData, "effectiveFrom"),
        reason: value(formData, "reason"),
      }),
    "newRentScheduled",
  );
}

export async function changeResponsibleAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () =>
      changeResponsible({
        tenancyId: value(formData, "tenancyId"),
        occupantId: value(formData, "occupantId"),
        effectiveFrom: value(formData, "effectiveFrom"),
        reason: value(formData, "reason"),
      }),
    "responsibleChanged",
  );
}
function file(formData: FormData, name: string) {
  const candidate = formData.get(name);
  return candidate instanceof File && candidate.size ? candidate : undefined;
}

export async function moveInAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const feedback = await getActionFeedback("tenants");
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
      electricityReading: value(formData, "electricityReading") || null,
      electricityPhoto: file(formData, "electricityPhoto"),
    };
    const responsiblePersonId = value(formData, "responsiblePersonId");
    if (responsiblePersonId === "__new") {
      const person = parseNewPersonForAction(
        {
          fullName: value(formData, "newPersonName"),
          phone: value(formData, "newPersonPhone") || undefined,
          citizenId: value(formData, "newPersonCitizenId") || undefined,
        },
        feedback,
      );
      if (!person.ok) return { ok: false, message: person.message };

      await moveInWithNewResponsible({
        ...baseInput,
        person: person.data,
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
          ...formData.getAll("additionalPersonIds").map((personId) => ({
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
    return { ok: true, message: feedback("moveInRecorded") };
  } catch (error) {
    if (error instanceof TenancyDomainError) {
      return { ok: false, message: localizeTenancyError(error, feedback) };
    }
    if (error instanceof PeopleDomainError) {
      return { ok: false, message: localizePeopleDomainError(error, feedback) };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, message: localizePersonValidationError(error, feedback) };
    }
    console.error(error);
    return { ok: false, message: feedback("moveInFailed") };
  }
}

export async function moveOutAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const feedback = await getActionFeedback("tenants");
  try {
    await moveOut({
      tenancyId: value(formData, "tenancyId"),
      moveOutDate: value(formData, "moveOutDate"),
      moveOutNotes: value(formData, "moveOutNotes") || undefined,
      electricityReading: value(formData, "electricityReading") || null,
      electricityPhoto: file(formData, "electricityPhoto"),
      electricityReadingSource: value(formData, "electricityReadingSource") as
        "MEASURED" | "ESTIMATED",
      electricityReadingReason:
        value(formData, "electricityReadingReason") || undefined,
    });
    revalidatePath("/");
    revalidatePath("/tenants");
    return { ok: true, message: feedback("moveOutRecorded") };
  } catch (error) {
    if (error instanceof TenancyDomainError) {
      return { ok: false, message: localizeTenancyError(error, feedback) };
    }
    console.error(error);
    return { ok: false, message: feedback("moveOutFailed") };
  }
}

async function tenancyAction(
  work: () => Promise<unknown>,
  successKey: string,
): Promise<ActionState> {
  const feedback = await getActionFeedback("tenants");
  try {
    await work();
    revalidatePath("/");
    revalidatePath("/tenants");
    return { ok: true, message: feedback(successKey) };
  } catch (error) {
    if (error instanceof TenancyDomainError) {
      return { ok: false, message: localizeTenancyError(error, feedback) };
    }
    if (error instanceof PeopleDomainError) {
      return { ok: false, message: localizePeopleDomainError(error, feedback) };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, message: localizePersonValidationError(error, feedback) };
    }
    console.error(error);
    return { ok: false, message: feedback("rentalSaveFailed") };
  }
}

export async function addOccupantAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const occupancy = {
    tenancyId: value(formData, "tenancyId"),
    startDate: value(formData, "startDate"),
    notes: value(formData, "notes") || undefined,
  };
  const personId = value(formData, "personId");

  if (personId === "__new") {
    const feedback = await getActionFeedback("tenants");
    const person = parseNewPersonForAction(
      {
        fullName: value(formData, "newPersonName"),
        phone: value(formData, "newPersonPhone") || undefined,
      },
      feedback,
    );
    if (!person.ok) return { ok: false, message: person.message };

    return tenancyAction(
      () => addNewAdditionalOccupant(person.data, occupancy),
      "occupantAdded",
    );
  }

  return tenancyAction(
    () => addAdditionalOccupant({ ...occupancy, personId }),
    "occupantAdded",
  );
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
    "occupancyEnded",
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
    "occupantMoved",
  );
}

export async function cancelUpcomingMoveInAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () => cancelUpcomingMoveIn(value(formData, "tenancyId")),
    "moveInCancelled",
  );
}

export async function cancelScheduledMoveOutAction(
  _state: ActionState,
  formData: FormData,
) {
  return tenancyAction(
    () => cancelScheduledMoveOut(value(formData, "tenancyId")),
    "moveOutCancelled",
  );
}
