import { z } from "../openapi";

// Loose on purpose: this validates an envelope produced by another Kaneo
// fork's Generic Webhook plugin (events.ts's sendEvent), not by this
// codebase. Only the fields the mirror actually reads are constrained;
// everything else is passed through untouched.
export const mirrorTaskPayloadSchema = z
  .object({
    event: z.string(),
    // Which kaneo-mia project this task came from -- used to label the
    // mirrored task here, since several of their projects share one target
    // project on our side (see ensureLocalTask's originLabel).
    project: z.object({ name: z.string().optional() }).partial().optional(),
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
