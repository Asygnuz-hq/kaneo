import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getProjectMetrics from "./controllers/get-project-metrics";
import getWorkspaceWorkload from "./controllers/get-workspace-workload";
import { projectMetricsSchema, workspaceMetricsSchema } from "./response";
import { projectIdParam, workspaceIdParam } from "./schema";

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

const projectMetrics = apiRouter()
  .openapi(getProjectMetricsRoute, async (c) =>
    c.json(await getProjectMetrics(c.req.valid("param").projectId), 200),
  )
  .openapi(getWorkspaceWorkloadRoute, async (c) =>
    c.json(await getWorkspaceWorkload(c.req.valid("param").workspaceId), 200),
  );

export default projectMetrics;
