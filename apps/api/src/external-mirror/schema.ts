import { z } from "../openapi";

// Loose on purpose: this validates an envelope produced by another Kaneo
// fork's Generic Webhook plugin (events.ts's sendEvent), not by this
// codebase. Only the fields the mirror actually reads are constrained;
// everything else is passed through untouched.
export const mirrorTaskPayloadSchema = z
  .object({
    event: z.string(),
    task: z.object({
      id: z.string(),
      title: z.string().optional(),
      status: z.string().nullable().optional(),
      priority: z.string().nullable().optional(),
      url: z.string().optional(),
    }),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type MirrorTaskPayload = z.infer<typeof mirrorTaskPayloadSchema>;
