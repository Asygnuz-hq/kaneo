import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getProjectMetrics from "./controllers/get-project-metrics";
import { projectMetricsSchema } from "./response";
import { projectIdParam } from "./schema";

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

const projectMetrics = apiRouter().openapi(getProjectMetricsRoute, async (c) =>
  c.json(await getProjectMetrics(c.req.valid("param").projectId), 200),
);

export default projectMetrics;
