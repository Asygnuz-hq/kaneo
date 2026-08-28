import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

// ASYGNUZ: Scrum sprint. "active"/"completed" transitions go through the
// dedicated start/complete routes, not the plain update -- see
// controllers/start-sprint.ts and complete-sprint.ts for why.
export const sprintSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    goal: z.string().nullable(),
    startDate: nullableResponseTimestamp,
    endDate: nullableResponseTimestamp,
    status: z
      .string()
      .openapi({ description: "One of: planned, active, completed." }),
    position: z.number(),
    createdAt: responseTimestamp,
  })
  .openapi("Sprint");

export const sprintListSchema = z.array(sprintSchema);

export const completedSprintSchema = sprintSchema
  .extend({
    movedToBacklog: z.number().openapi({
      description: "How many unfinished tasks were sent back to the backlog.",
    }),
  })
  .openapi("CompletedSprint");
