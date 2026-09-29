"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionFeedback } from "@/i18n/action-feedback";
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

type PropertyFeedback = Awaited<ReturnType<typeof getActionFeedback>>;

const PROPERTY_VALIDATION_KEYS: Record<string, string> = {
  "Missing identifier.": "validationMissingIdentifier",
  "Name is required.": "validationNameRequired",
  "Name must be 120 characters or fewer.": "validationNameTooLong",
  "Text must be 1000 characters or fewer.": "validationTextTooLong",
  "Level must be a number.": "validationLevelNumber",
  "Level must be a whole number.": "validationLevelWholeNumber",
  "Level is unexpectedly low.": "validationLevelTooLow",
  "Level is unexpectedly high.": "validationLevelTooHigh",
};


const PROPERTY_DOMAIN_KEYS: Record<string, string> = {
  "The item being reordered was not found.": "errorReorderItemNotFound",
  "Archive or move spaces before archiving this floor.": "errorFloorHasSpaces",
  "Delete is only allowed for floors with no spaces.": "errorDeleteFloorWithSpaces",
  "The selected space does not belong to this floor.": "errorSpaceWrongFloor",
  "The requested record was not found.": "errorRecordNotFound",
  "The selected property was not found.": "errorPropertyNotFound",
  "The selected floor was not found.": "errorFloorNotFound",
  "The selected space was not found.": "errorSpaceNotFound",
  "A room with a current or upcoming tenancy cannot be archived.": "errorSpaceHasTenancy",
};

function localizePropertyDomainError(
  error: DomainError,
  feedback: PropertyFeedback,
) {
  const key = PROPERTY_DOMAIN_KEYS[error.message];
  return key ? feedback(key) : feedback("saveFailed");
}
function localizePropertyFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
  feedback: PropertyFeedback,
) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      messages?.map((message) => {
        const key = PROPERTY_VALIDATION_KEYS[message];
        if (key) return feedback(key);
        if (message.startsWith("Invalid option")) {
          return feedback("validationSpaceType");
        }
        return message;
      }),
    ]),
  );
}

async function runAction<TSchema extends z.ZodType>(
  schema: TSchema,
  formData: FormData,
  handler: (input: z.infer<TSchema>) => Promise<void>,
  successKey: string,
): Promise<ActionState> {
  const feedback = await getActionFeedback("property");
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: feedback("checkFields"),
      fieldErrors: localizePropertyFieldErrors(
        z.flattenError(parsed.error).fieldErrors,
        feedback,
      ),
    };
  }

  try {
    await handler(parsed.data);
    revalidatePath("/");
    revalidatePath("/building");
    revalidatePath("/dashboard");
    return { ok: true, message: feedback(successKey) };
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        ok: false,
        message: localizePropertyDomainError(error, feedback),
      };
    }

    console.error(error);
    return {
      ok: false,
      message: feedback("saveFailed"),
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
    "propertyUpdated",
  );
}

export async function createFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(createFloorSchema, formData, createFloor, "floorAdded");
}

export async function updateFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(updateFloorSchema, formData, updateFloor, "floorUpdated");
}

export async function reorderFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(
    reorderFloorSchema,
    formData,
    reorderFloor,
    "floorOrderUpdated",
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
    "floorArchived",
  );
}

export async function deleteFloorAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(deleteFloorSchema, formData, deleteFloor, "floorDeleted");
}

export async function createSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(createSpaceSchema, formData, createSpace, "spaceAdded");
}

export async function updateSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(updateSpaceSchema, formData, updateSpace, "spaceUpdated");
}

export async function reorderSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(
    reorderSpaceSchema,
    formData,
    reorderSpace,
    "spaceOrderUpdated",
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
    "spaceArchived",
  );
}

export async function deleteSpaceAction(
  _state: ActionState,
  formData: FormData,
) {
  return runAction(deleteSpaceSchema, formData, deleteSpace, "spaceDeleted");
}
