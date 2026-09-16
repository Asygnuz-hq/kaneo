import { z } from "../openapi";

export const workspaceMemberSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().openapi({
      description:
        "The member's workspace role: a built-in role (owner, admin, member, guest) or a custom role name.",
    }),
    hourlyRateCents: z.number().nullable().openapi({
      description:
        "This person's billing rate within this workspace, in cents. Null if unset.",
    }),
  })
  .openapi("WorkspaceMember");

export const workspaceMemberListSchema = z.array(workspaceMemberSchema);

export const workspaceMemberRateSchema = z
  .object({
    userId: z.string(),
    workspaceId: z.string(),
    hourlyRateCents: z.number().nullable(),
  })
  .openapi("WorkspaceMemberRate");
