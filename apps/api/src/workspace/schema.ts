import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const workspaceMemberRateParam = z.object({
  workspaceId: z.string(),
  userId: z.string(),
});

export const updateMemberRateBody = z.object({
  hourlyRateCents: z.number().int().min(0).nullable().openapi({
    description:
      "This person's billing rate within this workspace, in cents. Pass null to unset it.",
  }),
});
