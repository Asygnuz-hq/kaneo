import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const projectMemberParam = z.object({
  projectId: z.string(),
  userId: z.string(),
});

export const addProjectMemberBody = z.object({ userId: z.string() });
