"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";

import { DomainError } from "./domain/rules";
import {
  archiveFloorSchema,
  archiveSpaceSchema,
  createFloorSchema,
  createSpaceSchema,
  deleteFloorSchema,
  deleteSpaceSchema,
  reorderFloorSchema,
  reorderSpaceSchema,
  updateFloorSchema,
  updatePropertySchema,
  updateSpaceSchema,
} from "./domain/validation";
import {
  archiveFloor,
  archiveSpace,
  createFloor,
  createSpace,
  deleteFloor,
  deleteSpace,
  reorderFloor,
  reorderSpace,
  updateFloor,
  updateProperty,
  updateSpace,
} from "./server/property.service";

async function runAction<TSchema extends z.ZodType>(
  schema: TSchema,
  formData: FormData,
  handler: (input: z.infer<TSchema>) => Promise<void>,
  successMessage: string,
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
    revalidatePath("/");
    return { ok: true, message: successMessage };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, message: error.message };
    }

    console.error(error);
    return {
      ok: false,
      message: "The change could not be saved. Please try again.",
    };
  }
}

export async function updatePropertyAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(
    updatePropertySchema,
    formData,
    updateProperty,
    "Property updated.",
  );
}

export async function createFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(createFloorSchema, formData, createFloor, "Floor added.");
}

export async function updateFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(updateFloorSchema, formData, updateFloor, "Floor updated.");
}

export async function reorderFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(
    reorderFloorSchema,
    formData,
    reorderFloor,
    "Floor order updated.",
  );
}

export async function archiveFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(
    archiveFloorSchema,
    formData,
    archiveFloor,
    "Floor archived.",
  );
}

export async function deleteFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(deleteFloorSchema, formData, deleteFloor, "Floor deleted.");
}

export async function createSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(createSpaceSchema, formData, createSpace, "Space added.");
}

export async function updateSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(updateSpaceSchema, formData, updateSpace, "Space updated.");
}

export async function reorderSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(
    reorderSpaceSchema,
    formData,
    reorderSpace,
    "Space order updated.",
  );
}

export async function archiveSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(
    archiveSpaceSchema,
    formData,
    archiveSpace,
    "Space archived.",
  );
}

export async function deleteSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(deleteSpaceSchema, formData, deleteSpace, "Space deleted.");
}
