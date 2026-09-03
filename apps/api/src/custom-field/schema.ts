import { z } from "../openapi";
import { VALID_CUSTOM_FIELD_TYPES } from "./validate-custom-field";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const customFieldParam = z.object({ id: z.string() });

export const taskIdParam = z.object({ taskId: z.string() });

export const taskCustomFieldValueParam = z.object({
  taskId: z.string(),
  customFieldId: z.string(),
});

const customFieldTypeSchema = z.enum(VALID_CUSTOM_FIELD_TYPES);

export const createCustomFieldBody = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1).max(60),
  type: customFieldTypeSchema,
  // Required for "select", rejected for every other type -- see
  // assertValidOptions in validate-custom-field.ts.
  options: z.array(z.string()).optional(),
});

export const updateCustomFieldBody = z.object({
  name: z.string().trim().min(1).max(60),
  // Only meaningful when the field is a "select" -- the type itself can't
  // be changed after creation (see custom-field/index.ts's updateCustomFieldRoute
  // description).
  options: z.array(z.string()).optional(),
});

export const setTaskCustomFieldValueBody = z.object({
  // Always a real, type-valid value -- unsetting is DELETE
  // /task/{taskId}/{customFieldId} instead, not a null here.
  value: z.string().min(1),
});
