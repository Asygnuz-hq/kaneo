import { responseTimestamp, z } from "../openapi";

const relationTypeDescription =
  "How the two tasks relate: `subtask`, `blocks`, or `related`.";

const relatedTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string().nullable(),
    number: z.number().nullable(),
    projectId: z.string(),
    userId: z.string().nullable(),
    assigneeName: z.string().nullable(),
  })
  .openapi("RelatedTask");

export const taskRelationSchema = z
  .object({
    id: z.string(),
    sourceTaskId: z.string(),
    targetTaskId: z.string(),
    relationType: z.string().openapi({ description: relationTypeDescription }),
    createdAt: responseTimestamp,
  })
  .openapi("TaskRelation");

// Always present in practice: relations whose endpoints are not both visible in
// the workspace are dropped. Nullable only because the lookup is a map read.
export const taskRelationWithTasksSchema = taskRelationSchema
  .extend({
    sourceTask: relatedTaskSchema.nullable(),
    targetTask: relatedTaskSchema.nullable(),
  })
  .openapi("TaskRelationWithTasks");

export const taskRelationWithTasksListSchema = z.array(
  taskRelationWithTasksSchema,
);

// ASYGNUZ: the "subtask" relations for every task in a project, in bulk --
// backs the list view's Épica -> Tareas -> Subtareas tree without one
// getTaskRelations call per row. Bare ids only; the tree is built client-side
// from tasks it already has.
export const projectSubtaskRelationSchema = z
  .object({
    id: z.string(),
    sourceTaskId: z.string(),
    targetTaskId: z.string(),
  })
  .openapi("ProjectSubtaskRelation");

// ASYGNUZ: same shape, but for "blocks" relations -- backs the Gantt view's
// dependency arrows in bulk per project. sourceTaskId blocks targetTaskId.
export const projectBlockingRelationSchema = z
  .object({
    id: z.string(),
    sourceTaskId: z.string(),
    targetTaskId: z.string(),
  })
  .openapi("ProjectBlockingRelation");

export const projectBlockingRelationListSchema = z.array(
  projectBlockingRelationSchema,
);

export const projectSubtaskRelationListSchema = z.array(
  projectSubtaskRelationSchema,
);
