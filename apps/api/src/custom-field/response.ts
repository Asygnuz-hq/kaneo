import { responseTimestamp, z } from "../openapi";
import { VALID_CUSTOM_FIELD_TYPES } from "./validate-custom-field";

// ASYGNUZ: Campos Personalizados -- field definitions (workspace-level) and
// the values a task holds for them (task-level). See schema.ts's comments
// on customFieldTable/taskCustomFieldValueTable for the reasoning.

export const customFieldSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    type: z.enum(VALID_CUSTOM_FIELD_TYPES),
    options: z.array(z.string()).nullable(),
    position: z.number(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("CustomField");

export const customFieldListSchema = z.array(customFieldSchema);

export const removedCustomFieldSchema = z
  .object({ id: z.string() })
  .openapi("RemovedCustomField");

export const taskCustomFieldValueSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    customFieldId: z.string(),
    value: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TaskCustomFieldValue");

export const taskCustomFieldValueListSchema = z.array(
  taskCustomFieldValueSchema,
);

export const removedTaskCustomFieldValueSchema = z
  .object({ taskId: z.string(), customFieldId: z.string() })
  .openapi("RemovedTaskCustomFieldValue");
