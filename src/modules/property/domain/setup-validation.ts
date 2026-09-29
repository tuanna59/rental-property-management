import { z } from "zod";

import { SPACE_TYPE_OPTIONS } from "./types";

const requiredName = z
  .string()
  .trim()
  .min(1, "required")
  .max(120, "tooLong");

const optionalDescription = z
  .string()
  .trim()
  .max(1000, "tooLong")
  .optional()
  .transform((value) => (value ? value : undefined));

const setupSpaceSchema = z.object({
  name: requiredName,
  type: z.enum(SPACE_TYPE_OPTIONS),
});

const setupFloorSchema = z.object({
  name: requiredName,
  spaces: z.array(setupSpaceSchema),
});

export const initialPropertySetupSchema = z.object({
  name: requiredName,
  description: optionalDescription,
  floors: z.array(setupFloorSchema).min(1, "floorRequired"),
});

export type InitialPropertySetupValues = z.infer<
  typeof initialPropertySetupSchema
>;
