import { responseTimestamp, z } from "../openapi";

const activityTypeDescription =
  "One of: comment, task, create, status_changed, priority_changed, assignee_changed, unassigned, due_date_changed, title_changed, description_changed.";

export const activityReactionSchema = z
  .object({
    // Plain string, not the stricter reactionEmojiSchema enum from
    // ./schema: that enum only needs to gate what's accepted as *input* on
    // the toggle route -- a value already stored in the database is
    // trusted as-is on the way back out.
    emoji: z.string(),
    count: z.number(),
    reactedByMe: z.boolean().openapi({
      description: "Whether the requesting user is one of the reactors.",
    }),
  })
  .openapi("ActivityReaction");

export const activitySchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    type: z.string().openapi({ description: activityTypeDescription }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    userId: z.string().nullable(),
    content: z.string().nullable(),
    eventData: z.unknown().openapi({
      description:
        "Type-specific payload, e.g. { oldStatus, newStatus } for status_changed. Null for plain comments.",
    }),
    externalUserName: z.string().nullable().openapi({
      description: "Set when the activity was imported from another tool.",
    }),
    externalUserAvatar: z.string().nullable(),
    externalSource: z.string().nullable().openapi({
      description: "The tool it was imported from, e.g. planka, trello, jira.",
    }),
    externalUrl: z.string().nullable(),
    reactions: z.array(activityReactionSchema).optional().openapi({
      description:
        "Emoji reactions, grouped and counted. Only populated by the list route; absent on the create/update/delete responses, which return the bare activity.",
    }),
  })
  .openapi("Activity");

export const activityListSchema = z.array(activitySchema);
