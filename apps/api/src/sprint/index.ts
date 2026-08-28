import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import {
  validateAndParseDate,
  validateDateRange,
} from "../utils/validate-dates";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import completeSprintCtrl from "./controllers/complete-sprint";
import createSprintCtrl from "./controllers/create-sprint";
import deleteSprintCtrl from "./controllers/delete-sprint";
import listSprintsCtrl from "./controllers/list-sprints";
import startSprintCtrl from "./controllers/start-sprint";
import updateSprintCtrl from "./controllers/update-sprint";
import {
  completedSprintSchema,
  sprintListSchema,
  sprintSchema,
} from "./response";
import {
  createSprintBody,
  projectIdParam,
  sprintIdParam,
  updateSprintBody,
} from "./schema";

// ASYGNUZ: Scrum sprints, one level up from the backlog. See
// database/schema.ts (sprintTable) for the shape and
// controllers/{start,complete}-sprint.ts for the lifecycle rules.

const listSprintsRoute = createRoute({
  method: "get",
  operationId: "listSprints",
  path: "/project/{projectId}",
  tags: ["Sprints"],
  summary: "List sprints",
  description: "List a project's sprints, in position order.",
  // projectId travels as a path param, not a query string, so it's read from
  // the same place workspaceAccess.fromProject() checks -- see the "Only
  // accept the id from..." comment in workspace-access-middleware.ts for why
  // query params aren't an accepted source there.
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Project sprints", sprintListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createSprintRoute = createRoute({
  method: "post",
  operationId: "createSprint",
  path: "/",
  tags: ["Sprints"],
  summary: "Create sprint",
  description: "Create a new sprint in a project, starting out 'planned'.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createSprintBody } },
    },
  },
  responses: {
    200: jsonResponse("The created sprint", sprintSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateSprintRoute = createRoute({
  method: "put",
  operationId: "updateSprint",
  path: "/{id}",
  tags: ["Sprints"],
  summary: "Update sprint",
  description: "Rename a sprint or change its goal/dates.",
  middleware: [
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: sprintIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateSprintBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated sprint", sprintSchema),
    400: errorResponse("Invalid body, or unknown sprint"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteSprintRoute = createRoute({
  method: "delete",
  operationId: "deleteSprint",
  path: "/{id}",
  tags: ["Sprints"],
  summary: "Delete sprint",
  description:
    "Delete a sprint. Its tasks go back to the backlog, they are not deleted.",
  middleware: [
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: sprintIdParam },
  responses: {
    200: jsonResponse("The deleted sprint", sprintSchema),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Sprint not found"),
  },
});

const startSprintRoute = createRoute({
  method: "put",
  operationId: "startSprint",
  path: "/{id}/start",
  tags: ["Sprints"],
  summary: "Start sprint",
  description:
    "Mark a 'planned' sprint 'active'. A project can only have one active sprint at a time.",
  middleware: [
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: sprintIdParam },
  responses: {
    200: jsonResponse("The started sprint", sprintSchema),
    400: errorResponse(
      "Sprint is not 'planned', or the project already has an active sprint",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const completeSprintRoute = createRoute({
  method: "put",
  operationId: "completeSprint",
  path: "/{id}/complete",
  tags: ["Sprints"],
  summary: "Complete sprint",
  description:
    "Mark an 'active' sprint 'completed'. Unfinished tasks (not in a final column) go back to the backlog.",
  middleware: [
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: sprintIdParam },
  responses: {
    200: jsonResponse("The completed sprint", completedSprintSchema),
    400: errorResponse("Sprint is not 'active'"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const sprint = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listSprintsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await listSprintsCtrl(projectId), 200);
  })
  .openapi(createSprintRoute, async (c) => {
    const { projectId, name, goal, startDate, endDate } = c.req.valid("json");

    const parsedStartDate =
      startDate !== undefined
        ? validateAndParseDate(startDate, "startDate")
        : undefined;
    const parsedEndDate =
      endDate !== undefined
        ? validateAndParseDate(endDate, "endDate")
        : undefined;
    validateDateRange(parsedStartDate, parsedEndDate);

    const created = await createSprintCtrl({
      projectId,
      name,
      goal,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
    return c.json(created, 200);
  })
  .openapi(updateSprintRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { name, goal, startDate, endDate } = c.req.valid("json");

    const parsedStartDate =
      startDate !== undefined && startDate !== null
        ? validateAndParseDate(startDate, "startDate")
        : startDate;
    const parsedEndDate =
      endDate !== undefined && endDate !== null
        ? validateAndParseDate(endDate, "endDate")
        : endDate;

    const updated = await updateSprintCtrl(id, {
      name,
      goal,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
    return c.json(updated, 200);
  })
  .openapi(deleteSprintRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await deleteSprintCtrl(id), 200);
  })
  .openapi(startSprintRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await startSprintCtrl(id), 200);
  })
  .openapi(completeSprintRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await completeSprintCtrl(id), 200);
  });

export default sprint;
