import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const externalContactParam = z.object({ id: z.string() });

export const createExternalContactBody = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1).max(80),
});
