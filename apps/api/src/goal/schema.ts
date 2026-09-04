import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const goalParam = z.object({ id: z.string() });

export const goalTaskParam = z.object({ id: z.string(), taskId: z.string() });

export const createGoalBody = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  status: z.string().default("on-track"),
  // Optional date/datetime string, parsed and validated in the controller.
  targetDate: z.string().optional(),
});

export const updateGoalBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  targetDate: z.string().nullable().optional(),
});

export const linkTaskBody = z.object({
  taskId: z.string(),
});
