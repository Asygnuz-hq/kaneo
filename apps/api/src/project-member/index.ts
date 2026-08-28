import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import addProjectMemberCtrl from "./controllers/add-project-member";
import listProjectMembersCtrl from "./controllers/list-project-members";
import removeProjectMemberCtrl from "./controllers/remove-project-member";
import {
  projectMemberListSchema,
  projectMembershipSchema,
  removedProjectMemberSchema,
} from "./response";
import {
  addProjectMemberBody,
  projectIdParam,
  projectMemberParam,
} from "./schema";

// ASYGNUZ: control de acceso por proyecto. Administrar quién ve qué proyecto
// requiere el mismo permiso que administrar el workspace (owner/admin) — ver
// packages/permissions: solo esos roles traen "manage_settings".

const listProjectMembersRoute = createRoute({
  method: "get",
  operationId: "listProjectMembers",
  path: "/{projectId}",
  tags: ["Project Members"],
  summary: "List project members",
  description:
    "List the users explicitly granted access to a project (ASYGNUZ).",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Project members", projectMemberListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
  },
});

const addProjectMemberRoute = createRoute({
  method: "post",
  operationId: "addProjectMember",
  path: "/{projectId}",
  tags: ["Project Members"],
  summary: "Add project member",
  description:
    "Grant a workspace user access to a project (ASYGNUZ). Once a project has at least one member, only its members (plus workspace owner/admin) can see it.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: addProjectMemberBody } },
    },
  },
  responses: {
    200: jsonResponse("Member added", projectMembershipSchema),
    400: errorResponse(
      "Invalid body, unknown project, or the user doesn't belong to the project's workspace",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
  },
});

const removeProjectMemberRoute = createRoute({
  method: "delete",
  operationId: "removeProjectMember",
  path: "/{projectId}/{userId}",
  tags: ["Project Members"],
  summary: "Remove project member",
  description: "Revoke a user's explicit access to a project (ASYGNUZ).",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: projectMemberParam },
  responses: {
    200: jsonResponse("Member removed", removedProjectMemberSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
  },
});

const projectMember = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listProjectMembersRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await listProjectMembersCtrl(projectId), 200);
  })
  .openapi(addProjectMemberRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { userId } = c.req.valid("json");
    return c.json(await addProjectMemberCtrl(projectId, userId), 200);
  })
  .openapi(removeProjectMemberRoute, async (c) => {
    const { projectId, userId } = c.req.valid("param");
    return c.json(await removeProjectMemberCtrl(projectId, userId), 200);
  });

export default projectMember;
