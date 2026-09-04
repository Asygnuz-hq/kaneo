import { responseTimestamp, z } from "../openapi";

export const recurringTaskSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.string(),
    issueType: z.string(),
    labelIds: z.array(z.string()),
    assigneeId: z.string().nullable(),
    frequency: z.string(),
    isActive: z.boolean(),
    nextRunAt: responseTimestamp,
    lastRunAt: responseTimestamp.nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("RecurringTask");

export const recurringTaskListSchema = z.array(recurringTaskSchema);

export const removedRecurringTaskSchema = z
  .object({ id: z.string() })
  .openapi("RemovedRecurringTask");
