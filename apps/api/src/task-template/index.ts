import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createTaskTemplate from "./controllers/create-task-template";
import deleteTaskTemplate from "./controllers/delete-task-template";
import listTaskTemplates from "./controllers/list-task-templates";
import updateTaskTemplate from "./controllers/update-task-template";
import {
  removedTaskTemplateSchema,
  taskTemplateListSchema,
  taskTemplateSchema,
} from "./response";
import {
  createTaskTemplateBody,
  projectIdParam,
  taskTemplateParam,
  updateTaskTemplateBody,
} from "./schema";

const listTaskTemplatesRoute = createRoute({
  method: "get",
  operationId: "listTaskTemplates",
  path: "/project/{projectId}",
  tags: ["Task Templates"],
  summary: "List task templates",
  description: "Get every reusable task template for a project.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of task templates", taskTemplateListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createTaskTemplateRoute = createRoute({
  method: "post",
  operationId: "createTaskTemplate",
  path: "/",
  tags: ["Task Templates"],
  summary: "Create task template",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTaskTemplateBody } },
    },
  },
  responses: {
    200: jsonResponse("The created template", taskTemplateSchema),
    400: errorResponse("Invalid body, unknown project, or duplicate name"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateTaskTemplateRoute = createRoute({
  method: "put",
  operationId: "updateTaskTemplate",
  path: "/{id}",
  tags: ["Task Templates"],
  summary: "Update task template",
  middleware: [
    workspaceAccess.fromTaskTemplate("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: taskTemplateParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTaskTemplateBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated template", taskTemplateSchema),
    400: errorResponse("Invalid body, unknown template, or duplicate name"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteTaskTemplateRoute = createRoute({
  method: "delete",
  operationId: "deleteTaskTemplate",
  path: "/{id}",
  tags: ["Task Templates"],
  summary: "Delete task template",
  middleware: [
    workspaceAccess.fromTaskTemplate("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: taskTemplateParam },
  responses: {
    200: jsonResponse("The deleted template", removedTaskTemplateSchema),
    400: errorResponse("Unknown template"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const taskTemplate = apiRouter()
  .openapi(listTaskTemplatesRoute, async (c) =>
    c.json(await listTaskTemplates(c.req.valid("param").projectId), 200),
  )
  .openapi(createTaskTemplateRoute, async (c) => {
    const body = c.req.valid("json");
    return c.json(await createTaskTemplate(body), 200);
  })
  .openapi(updateTaskTemplateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(await updateTaskTemplate({ id, ...body }), 200);
  })
  .openapi(deleteTaskTemplateRoute, async (c) =>
    c.json(await deleteTaskTemplate(c.req.valid("param").id), 200),
  );

export default taskTemplate;
