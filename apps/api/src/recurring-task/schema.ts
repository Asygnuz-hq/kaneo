import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const recurringTaskParam = z.object({ id: z.string() });

export const createRecurringTaskBody = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  priority: z.string().default("no-priority"),
  issueType: z.string().default("task"),
  labelIds: z.array(z.string()).default([]),
  assigneeId: z.string().optional(),
  frequency: z.string(),
  // First occurrence. A date/datetime string, parsed and validated in the
  // controller (same convention as task.startDate/dueDate).
  startAt: z.string(),
});

export const updateRecurringTaskBody = z.object({
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  issueType: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
  frequency: z.string().optional(),
  nextRunAt: z.string().optional(),
  isActive: z.boolean().optional(),
});
