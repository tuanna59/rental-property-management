"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";

import { PeopleDomainError } from "./domain/identity";
import {
  archivePersonSchema,
  createPersonSchema,
  updatePersonSchema,
} from "./domain/validation";
import { replacePersonMedia } from "./server/media";
import { PERSON_MEDIA_KINDS } from "./server/private-storage";
import {
  archivePerson,
  createPerson,
  restorePerson,
  updatePerson,
} from "./server/people.service";
import { revealPersonCitizenId } from "./server/people.queries";

async function personAction<T extends z.ZodType>(
  schema: T,
  formData: FormData,
  handler: (input: z.infer<T>) => Promise<unknown>,
  success: string,
): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  try {
    await handler(parsed.data);
    revalidatePath("/tenants");
    revalidatePath("/");
    return { ok: true, message: success };
  } catch (error) {
    if (error instanceof PeopleDomainError) {
      return { ok: false, message: error.message };
    }
    console.error(error);
    return { ok: false, message: "The person could not be saved." };
  }
}

export async function createPersonAction(
  _state: ActionState,
  formData: FormData,
) {
  return personAction(
    createPersonSchema,
    formData,
    createPerson,
    "Person added.",
  );
}

export async function updatePersonAction(
  _state: ActionState,
  formData: FormData,
) {
  return personAction(
    updatePersonSchema,
    formData,
    updatePerson,
    "Person updated.",
  );
}

export async function archivePersonAction(
  _state: ActionState,
  formData: FormData,
) {
  return personAction(
    archivePersonSchema,
    formData,
    archivePerson,
    "Person archived.",
  );
}

export async function restorePersonAction(
  _state: ActionState,
  formData: FormData,
) {
  return personAction(
    archivePersonSchema,
    formData,
    restorePerson,
    "Person restored.",
  );
}

export async function revealCitizenIdAction(personId: string) {
  try {
    const value = await revealPersonCitizenId(personId);
    return value
      ? { ok: true as const, value }
      : { ok: false as const, message: "No citizen ID is stored." };
  } catch (error) {
    if (error instanceof PeopleDomainError) {
      return { ok: false as const, message: error.message };
    }
    console.error(error);
    return { ok: false as const, message: "Citizen ID could not be revealed." };
  }
}

export async function uploadPersonMediaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const personId = String(formData.get("personId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("image");
  if (
    !personId ||
    !PERSON_MEDIA_KINDS.includes(kind as never) ||
    !(file instanceof File)
  ) {
    return { ok: false, message: "Choose an image to upload." };
  }
  try {
    await replacePersonMedia(
      personId,
      kind as (typeof PERSON_MEDIA_KINDS)[number],
      file,
    );
    revalidatePath("/tenants");
    return { ok: true, message: "Private image replaced." };
  } catch (error) {
    const safeMessage =
      error instanceof Error &&
      (error.message.startsWith("Choose a valid") ||
        error.message.startsWith("Choose an image") ||
        error.message === "The selected person was not found.")
        ? error.message
        : null;
    if (!safeMessage) console.error(error);
    return {
      ok: false,
      message: safeMessage ?? "The image could not be saved.",
    };
  }
}
