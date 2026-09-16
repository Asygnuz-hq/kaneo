import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import updateMemberRateCtrl from "./controllers/update-member-rate";
import {
  workspaceMemberListSchema,
  workspaceMemberRateSchema,
} from "./response";
import {
  updateMemberRateBody,
  workspaceIdParam,
  workspaceMemberRateParam,
} from "./schema";

const getWorkspaceMembersRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceMembers",
  path: "/{workspaceId}/members",
  tags: ["Workspaces"],
  summary: "Get workspace members",
  description: "Get all members of a workspace, with their role.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("List of workspace members", workspaceMemberListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const updateMemberRateRoute = createRoute({
  method: "put",
  operationId: "updateMemberRate",
  path: "/{workspaceId}/members/{userId}/rate",
  tags: ["Workspaces"],
  summary: "Set a member's hourly rate",
  description:
    "Set or clear a workspace member's billing rate, used to cost their future time entries. Never rewrites the rate already snapshotted on entries logged before this change.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: workspaceMemberRateParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateMemberRateBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated member rate", workspaceMemberRateSchema),
    400: errorResponse("That user isn't a member of this workspace"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings permission",
    ),
  },
});

const workspace = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getWorkspaceMembersRoute, async (c) =>
    c.json(await getWorkspaceMembersCtrl(c.get("workspaceId")), 200),
  )
  .openapi(updateMemberRateRoute, async (c) => {
    const { workspaceId, userId } = c.req.valid("param");
    const { hourlyRateCents } = c.req.valid("json");
    return c.json(
      await updateMemberRateCtrl({ workspaceId, userId, hourlyRateCents }),
      200,
    );
  });

export default workspace;
