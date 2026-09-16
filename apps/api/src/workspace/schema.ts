import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const workspaceMemberRateParam = z.object({
  workspaceId: z.string(),
  userId: z.string(),
});

export const updateMemberRateBody = z.object({
  hourlyRateCents: z.number().int().min(0).nullable().optional().openapi({
    description:
      "This person's internal cost rate within this workspace, in cents (what their time costs the company). Pass null to unset it. Omit to leave unchanged.",
  }),
  billRateCents: z.number().int().min(0).nullable().optional().openapi({
    description:
      "This person's client-billing rate within this workspace, in cents (what gets invoiced for their time). Pass null to unset it. Omit to leave unchanged.",
  }),
});
