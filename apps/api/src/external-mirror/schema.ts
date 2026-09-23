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
      // kaneo-mia's hierarchy is story > task > subtask, and `parent` is the
      // task this one hangs from (sent on every event, so the parent can be
      // created here too if we never saw it).
      type: z.string().nullable().optional(),
      // Set when this kaneo-mia task is itself the mirror of one of OUR
      // tasks: the id of ours. Lets their later changes find it here.
      mirroredFrom: z.string().nullable().optional(),
      parent: z
        .object({
          id: z.string(),
          title: z.string().optional(),
          type: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      assignee: z
        .object({
          name: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    }),
    // Who performed the action on kaneo-mia's side -- used to attribute a
    // mirrored comment, since it was never actually written by anyone in
    // this workspace.
    actor: z
      .object({ name: z.string().nullable().optional() })
      .nullable()
      .optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type MirrorTaskPayload = z.infer<typeof mirrorTaskPayloadSchema>;
