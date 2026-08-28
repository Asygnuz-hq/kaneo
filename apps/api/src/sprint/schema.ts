import { z } from "../openapi";

export const sprintIdParam = z.object({ id: z.string() });

export const projectIdParam = z.object({ projectId: z.string() });

export const createSprintBody = z.object({
  projectId: z.string(),
  name: z.string(),
  goal: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const updateSprintBody = z.object({
  name: z.string().optional(),
  goal: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});
