import { responseTimestamp, z } from "../openapi";

// ASYGNUZ: an external client's access to a project's Service Desk portal.
// "pending" means the account was invited but hasn't set a password yet.
export const clientAccessSchema = z
  .object({
    id: z.string(),
    clientAccountId: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    status: z.enum(["pending", "active"]),
    createdAt: responseTimestamp,
  })
  .openapi("ClientAccess");

export const clientAccessListSchema = z.array(clientAccessSchema);

export const invitedClientResponseSchema = clientAccessSchema
  .extend({
    // Only set when a new invite/setup token was just issued (new client,
    // or re-inviting one who never activated) -- lets the inviter copy the
    // link by hand when SMTP isn't configured. Null for an already-active
    // client just granted another project.
    inviteLink: z.string().nullable(),
  })
  .openapi("InvitedClient");

export const removedClientAccessSchema = z
  .object({
    projectId: z.string(),
    clientAccountId: z.string(),
  })
  .openapi("RemovedClientAccess");
