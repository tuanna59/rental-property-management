import { z } from "zod";

import { SPACE_TYPE_OPTIONS } from "./types";

const idSchema = z.string().trim().min(1, "Missing identifier.");
const requiredNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must be 120 characters or fewer.");
const optionalTextSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(1000, "Text must be 1000 characters or fewer.")
    .optional(),
);
const optionalLevelSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number({ error: "Level must be a number." })
    .int("Level must be a whole number.")
    .min(-10, "Level is unexpectedly low.")
    .max(200, "Level is unexpectedly high.")
    .optional(),
);

export const updatePropertySchema = z.object({
  propertyId: idSchema,
  name: requiredNameSchema,
  addressLine1: optionalTextSchema,
  city: optionalTextSchema,
  country: optionalTextSchema,
  description: optionalTextSchema,
});

export const createFloorSchema = z.object({
  propertyId: idSchema,
  name: requiredNameSchema,
  level: optionalLevelSchema,
  notes: optionalTextSchema,
});

export const updateFloorSchema = z.object({
  floorId: idSchema,
  name: requiredNameSchema,
  level: optionalLevelSchema,
  notes: optionalTextSchema,
});

export const reorderFloorSchema = z.object({
  propertyId: idSchema,
  floorId: idSchema,
  direction: z.enum(["up", "down"]),
});

export const archiveFloorSchema = z.object({
  floorId: idSchema,
});

export const deleteFloorSchema = z.object({
  floorId: idSchema,
});

export const createSpaceSchema = z.object({
  floorId: idSchema,
  name: requiredNameSchema,
  type: z.enum(SPACE_TYPE_OPTIONS),
  notes: optionalTextSchema,
});

export const updateSpaceSchema = z.object({
  spaceId: idSchema,
  name: requiredNameSchema,
  type: z.enum(SPACE_TYPE_OPTIONS),
  notes: optionalTextSchema,
});

export const reorderSpaceSchema = z.object({
  floorId: idSchema,
  spaceId: idSchema,
  direction: z.enum(["up", "down"]),
});

export const archiveSpaceSchema = z.object({
  spaceId: idSchema,
});

export const deleteSpaceSchema = z.object({
  spaceId: idSchema,
});
