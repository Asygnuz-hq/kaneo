import { responseTimestamp, z } from "../openapi";

export const goalSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.string(),
    targetDate: responseTimestamp.nullable(),
    position: z.number(),
    linkedTaskCount: z.number(),
    completedTaskCount: z.number(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Goal");

export const goalListSchema = z.array(goalSchema);

export const removedGoalSchema = z
  .object({ id: z.string() })
  .openapi("RemovedGoal");

export const goalTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    number: z.number().nullable(),
    isDone: z.boolean(),
  })
  .openapi("GoalTask");

export const goalTaskListSchema = z.array(goalTaskSchema);

export const removedGoalTaskSchema = z
  .object({ goalId: z.string(), taskId: z.string() })
  .openapi("RemovedGoalTask");

export const linkedGoalTaskSchema = z
  .object({ goalId: z.string(), taskId: z.string() })
  .openapi("LinkedGoalTask");

export const availableTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    number: z.number().nullable(),
  })
  .openapi("AvailableTask");

export const availableTaskListSchema = z.array(availableTaskSchema);
