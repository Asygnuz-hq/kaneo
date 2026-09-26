import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getProjectBudget from "./controllers/get-project-budget";
import getProjectMetrics from "./controllers/get-project-metrics";
import getWorkspaceForecast from "./controllers/get-workspace-forecast";
import getWorkspaceRecentlyClosed from "./controllers/get-workspace-recently-closed";
import getWorkspaceScheduleCompliance from "./controllers/get-workspace-schedule-compliance";
import getWorkspaceUpcomingWorkload from "./controllers/get-workspace-upcoming-workload";
import getWorkspaceWorkload from "./controllers/get-workspace-workload";
import {
  projectBudgetSchema,
  projectMetricsSchema,
  workspaceForecastSchema,
  workspaceMetricsSchema,
  workspaceRecentlyClosedSchema,
  workspaceScheduleComplianceSchema,
  workspaceUpcomingWorkloadSchema,
} from "./response";
import { daysQuery, projectIdParam, workspaceIdParam } from "./schema";

const getProjectMetricsRoute = createRoute({
  method: "get",
  operationId: "getProjectMetrics",
  path: "/{projectId}",
  tags: ["Project Metrics"],
  summary: "Get project workload metrics",
  description:
    "Task counts by status and priority, overdue/completed totals, and per-assignee workload for a project.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The project's metrics", projectMetricsSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const getWorkspaceWorkloadRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceWorkload",
  path: "/workspace/{workspaceId}",
  tags: ["Project Metrics"],
  summary: "Get workspace-wide workload",
  description:
    "Per-assignee open/total/overdue task counts summed across every non-archived project in the workspace, each broken down by project — the portfolio-level view of who is overloaded across the whole operation, not just within one board.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "The workspace's cross-project workload",
      workspaceMetricsSchema,
    ),
    403: errorResponse("No access to the workspace"),
  },
});

const getWorkspaceRecentlyClosedRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceRecentlyClosed",
  path: "/workspace/{workspaceId}/recently-closed",
  tags: ["Project Metrics"],
  summary: "Get recently closed tasks",
  description:
    "Tasks closed in the last N days (default 7) across every project in the workspace, newest first — the weekly 'what shipped' report.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam, query: daysQuery },
  responses: {
    200: jsonResponse(
      "Recently closed tasks in the workspace",
      workspaceRecentlyClosedSchema,
    ),
    403: errorResponse("No access to the workspace"),
  },
});

const getWorkspaceUpcomingWorkloadRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceUpcomingWorkload",
  path: "/workspace/{workspaceId}/upcoming-workload",
  tags: ["Project Metrics"],
  summary: "Get upcoming workload projection",
  description:
    "Open tasks due within the next N days (default 30) across the workspace, grouped by assignee — for planning whether the team can handle what's coming.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam, query: daysQuery },
  responses: {
    200: jsonResponse(
      "Upcoming workload projection",
      workspaceUpcomingWorkloadSchema,
    ),
    403: errorResponse("No access to the workspace"),
  },
});

const getWorkspaceForecastRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceForecast",
  path: "/workspace/{workspaceId}/forecast",
  tags: ["Project Metrics"],
  summary: "Forecast whether the team can take the upcoming workload",
  description:
    "For each assignee: how many tasks they close per week (last 8 weeks) against the open tasks due in the next N days (default 30) plus what is already overdue, with a verdict (ok, tight, overloaded) and how many tasks will not fit at that pace. Based on task counts and dates only, not effort.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam, query: daysQuery },
  responses: {
    200: jsonResponse("Workload forecast", workspaceForecastSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const getWorkspaceScheduleComplianceRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceScheduleCompliance",
  path: "/workspace/{workspaceId}/schedule-compliance",
  tags: ["Project Metrics"],
  summary: "Get schedule compliance",
  description:
    "Across every closed, dated task in the workspace: the percentage delivered on time or early, and the average deviation in days versus each task's dueDate.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "Workspace schedule compliance",
      workspaceScheduleComplianceSchema,
    ),
    403: errorResponse("No access to the workspace"),
  },
});

const getProjectBudgetRoute = createRoute({
  method: "get",
  operationId: "getProjectBudget",
  path: "/{projectId}/budget",
  tags: ["Project Metrics"],
  summary: "Get project budget vs. spend",
  description:
    "Contracted budget alongside spend derived from billable time logged so far, plus a simple burn-rate projection. Payroll-adjacent data — restricted to workspace:manage_settings, same as setting the budget or a member's rate.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The project's budget summary", projectBudgetSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings permission",
    ),
  },
});

const projectMetrics = apiRouter()
  .openapi(getProjectMetricsRoute, async (c) =>
    c.json(await getProjectMetrics(c.req.valid("param").projectId), 200),
  )
  .openapi(getWorkspaceWorkloadRoute, async (c) =>
    c.json(await getWorkspaceWorkload(c.req.valid("param").workspaceId), 200),
  )
  .openapi(getWorkspaceRecentlyClosedRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { days } = c.req.valid("query");
    return c.json(await getWorkspaceRecentlyClosed(workspaceId, days), 200);
  })
  .openapi(getWorkspaceUpcomingWorkloadRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { days } = c.req.valid("query");
    return c.json(await getWorkspaceUpcomingWorkload(workspaceId, days), 200);
  })
  .openapi(getWorkspaceForecastRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { days } = c.req.valid("query");
    return c.json(await getWorkspaceForecast(workspaceId, days), 200);
  })
  .openapi(getWorkspaceScheduleComplianceRoute, async (c) =>
    c.json(
      await getWorkspaceScheduleCompliance(c.req.valid("param").workspaceId),
      200,
    ),
  )
  .openapi(getProjectBudgetRoute, async (c) =>
    c.json(await getProjectBudget(c.req.valid("param").projectId), 200),
  );

export default projectMetrics;
