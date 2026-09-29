"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActionFeedback } from "@/i18n/action-feedback";
import type { ActionState } from "@/lib/action-state";
import { initialPropertySetupSchema } from "@/modules/property/domain/setup-validation";
import {
  createInitialProperty,
  PropertyAlreadyConfiguredError,
} from "@/modules/property/server/setup-property";

function parseFloors(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function completeSetupAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const feedback = await getActionFeedback("setup");
  const floors = parseFloors(formData.get("floors"));

  const parsed = initialPropertySetupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    floors,
  });

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    return {
      ok: false,
      message: feedback("checkFields"),
      fieldErrors: {
        name: flattened.fieldErrors.name,
        description: flattened.fieldErrors.description,
        floors: flattened.fieldErrors.floors,
      },
    };
  }

  try {
    await createInitialProperty(parsed.data);
  } catch (error) {
    if (error instanceof PropertyAlreadyConfiguredError) {
      return { ok: false, message: feedback("alreadyConfigured") };
    }

    console.error("Unable to complete initial property setup.", error);
    return { ok: false, message: feedback("saveFailed") };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "" };
}
