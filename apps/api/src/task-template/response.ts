import { responseTimestamp, z } from "../openapi";

export const taskTemplateSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.string(),
    issueType: z.string(),
    labelIds: z.array(z.string()),
    position: z.number(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TaskTemplate");

export const taskTemplateListSchema = z.array(taskTemplateSchema);

export const removedTaskTemplateSchema = z
  .object({ id: z.string() })
  .openapi("RemovedTaskTemplate");
