import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGoal from "./controllers/create-goal";
import deleteGoal from "./controllers/delete-goal";
import linkTaskToGoal from "./controllers/link-task-to-goal";
import listAvailableTasks from "./controllers/list-available-tasks";
import listGoalTasks from "./controllers/list-goal-tasks";
import listGoals from "./controllers/list-goals";
import unlinkTaskFromGoal from "./controllers/unlink-task-from-goal";
import updateGoal from "./controllers/update-goal";
import {
  availableTaskListSchema,
  goalListSchema,
  goalSchema,
  goalTaskListSchema,
  linkedGoalTaskSchema,
  removedGoalSchema,
  removedGoalTaskSchema,
} from "./response";
import {
  createGoalBody,
  goalParam,
  goalTaskParam,
  linkTaskBody,
  projectIdParam,
  updateGoalBody,
} from "./schema";

const listGoalsRoute = createRoute({
  method: "get",
  operationId: "listGoals",
  path: "/project/{projectId}",
  tags: ["Goals"],
  summary: "List goals",
  description:
    "Get every goal for a project, with progress computed from linked tasks.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of goals", goalListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const listAvailableTasksRoute = createRoute({
  method: "get",
  operationId: "listAvailableTasksForGoals",
  path: "/project/{projectId}/available-tasks",
  tags: ["Goals"],
  summary: "List a project's tasks for linking to a goal",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of tasks", availableTaskListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createGoalRoute = createRoute({
  method: "post",
  operationId: "createGoal",
  path: "/",
  tags: ["Goals"],
  summary: "Create goal",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createGoalBody } },
    },
  },
  responses: {
    200: jsonResponse("The created goal", goalSchema),
    400: errorResponse("Invalid body, unknown project, or duplicate title"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateGoalRoute = createRoute({
  method: "put",
  operationId: "updateGoal",
  path: "/{id}",
  tags: ["Goals"],
  summary: "Update goal",
  middleware: [
    workspaceAccess.fromGoal("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: goalParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateGoalBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated goal", goalSchema),
    400: errorResponse("Invalid body, unknown goal, or duplicate title"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteGoalRoute = createRoute({
  method: "delete",
  operationId: "deleteGoal",
  path: "/{id}",
  tags: ["Goals"],
  summary: "Delete goal",
  middleware: [
    workspaceAccess.fromGoal("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: goalParam },
  responses: {
    200: jsonResponse("The deleted goal", removedGoalSchema),
    400: errorResponse("Unknown goal"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const listGoalTasksRoute = createRoute({
  method: "get",
  operationId: "listGoalTasks",
  path: "/{id}/tasks",
  tags: ["Goals"],
  summary: "List a goal's linked tasks",
  middleware: [workspaceAccess.fromGoal("id")] as const,
  request: { params: goalParam },
  responses: {
    200: jsonResponse("List of linked tasks", goalTaskListSchema),
    400: errorResponse("Unknown goal"),
    403: errorResponse("No access to the goal's workspace"),
  },
});

const linkTaskToGoalRoute = createRoute({
  method: "post",
  operationId: "linkTaskToGoal",
  path: "/{id}/tasks",
  tags: ["Goals"],
  summary: "Link a task to a goal",
  middleware: [
    workspaceAccess.fromGoal("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: goalParam,
    body: {
      required: true,
      content: { "application/json": { schema: linkTaskBody } },
    },
  },
  responses: {
    200: jsonResponse("The link", linkedGoalTaskSchema),
    400: errorResponse(
      "Unknown goal/task, or the task belongs to a different project",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const unlinkTaskFromGoalRoute = createRoute({
  method: "delete",
  operationId: "unlinkTaskFromGoal",
  path: "/{id}/tasks/{taskId}",
  tags: ["Goals"],
  summary: "Unlink a task from a goal",
  middleware: [
    workspaceAccess.fromGoal("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: goalTaskParam },
  responses: {
    200: jsonResponse("The removed link", removedGoalTaskSchema),
    400: errorResponse("The task was not linked to this goal"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const goal = apiRouter()
  .openapi(listGoalsRoute, async (c) =>
    c.json(await listGoals(c.req.valid("param").projectId), 200),
  )
  .openapi(listAvailableTasksRoute, async (c) =>
    c.json(await listAvailableTasks(c.req.valid("param").projectId), 200),
  )
  .openapi(createGoalRoute, async (c) => {
    const body = c.req.valid("json");
    return c.json(await createGoal(body), 200);
  })
  .openapi(updateGoalRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(await updateGoal({ id, ...body }), 200);
  })
  .openapi(deleteGoalRoute, async (c) =>
    c.json(await deleteGoal(c.req.valid("param").id), 200),
  )
  .openapi(listGoalTasksRoute, async (c) =>
    c.json(await listGoalTasks(c.req.valid("param").id), 200),
  )
  .openapi(linkTaskToGoalRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { taskId } = c.req.valid("json");
    const link = await linkTaskToGoal(id, taskId);
    return c.json({ goalId: link.goalId, taskId: link.taskId }, 200);
  })
  .openapi(unlinkTaskFromGoalRoute, async (c) => {
    const { id, taskId } = c.req.valid("param");
    return c.json(await unlinkTaskFromGoal(id, taskId), 200);
  });

export default goal;
