import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const daysQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});
