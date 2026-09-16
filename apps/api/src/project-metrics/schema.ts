import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const workspaceIdParam = z.object({ workspaceId: z.string() });
