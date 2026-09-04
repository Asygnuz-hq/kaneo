import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createRecurringTask from "./controllers/create-recurring-task";
import deleteRecurringTask from "./controllers/delete-recurring-task";
import listRecurringTasks from "./controllers/list-recurring-tasks";
import updateRecurringTask from "./controllers/update-recurring-task";
import {
  recurringTaskListSchema,
  recurringTaskSchema,
  removedRecurringTaskSchema,
} from "./response";
import {
  createRecurringTaskBody,
  projectIdParam,
  recurringTaskParam,
  updateRecurringTaskBody,
} from "./schema";

const listRecurringTasksRoute = createRoute({
  method: "get",
  operationId: "listRecurringTasks",
  path: "/project/{projectId}",
  tags: ["Recurring Tasks"],
  summary: "List recurring tasks",
  description: "Get every recurring task definition for a project.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of recurring tasks", recurringTaskListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createRecurringTaskRoute = createRoute({
  method: "post",
  operationId: "createRecurringTask",
  path: "/",
  tags: ["Recurring Tasks"],
  summary: "Create recurring task",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createRecurringTaskBody } },
    },
  },
  responses: {
    200: jsonResponse("The created recurring task", recurringTaskSchema),
    400: errorResponse("Invalid body, unknown project, or duplicate name"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateRecurringTaskRoute = createRoute({
  method: "put",
  operationId: "updateRecurringTask",
  path: "/{id}",
  tags: ["Recurring Tasks"],
  summary: "Update recurring task",
  middleware: [
    workspaceAccess.fromRecurringTask("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: recurringTaskParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateRecurringTaskBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated recurring task", recurringTaskSchema),
    400: errorResponse(
      "Invalid body, unknown recurring task, or duplicate name",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteRecurringTaskRoute = createRoute({
  method: "delete",
  operationId: "deleteRecurringTask",
  path: "/{id}",
  tags: ["Recurring Tasks"],
  summary: "Delete recurring task",
  middleware: [
    workspaceAccess.fromRecurringTask("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: recurringTaskParam },
  responses: {
    200: jsonResponse("The deleted recurring task", removedRecurringTaskSchema),
    400: errorResponse("Unknown recurring task"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const recurringTask = apiRouter()
  .openapi(listRecurringTasksRoute, async (c) =>
    c.json(await listRecurringTasks(c.req.valid("param").projectId), 200),
  )
  .openapi(createRecurringTaskRoute, async (c) => {
    const body = c.req.valid("json");
    return c.json(await createRecurringTask(body), 200);
  })
  .openapi(updateRecurringTaskRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(await updateRecurringTask({ id, ...body }), 200);
  })
  .openapi(deleteRecurringTaskRoute, async (c) =>
    c.json(await deleteRecurringTask(c.req.valid("param").id), 200),
  );

export default recurringTask;
