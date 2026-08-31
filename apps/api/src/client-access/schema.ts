import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const clientAccessParam = z.object({
  projectId: z.string(),
  clientAccountId: z.string(),
});

export const inviteClientBody = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120).optional(),
});
