import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import inviteClientToProject from "./controllers/invite-client";
import listProjectClients from "./controllers/list-clients";
import removeProjectClient from "./controllers/remove-client";
import {
  clientAccessListSchema,
  invitedClientResponseSchema,
  removedClientAccessSchema,
} from "./response";
import { clientAccessParam, inviteClientBody, projectIdParam } from "./schema";

// ASYGNUZ: Service Desk -- managing which external clients can see a
// project's portal. Internal-facing (normal workspace auth), unlike
// client-auth/client-portal which are the client-facing side. Same
// permission gate as project-member: granting portal access is a
// workspace-admin-level action.

const listClientsRoute = createRoute({
  method: "get",
  operationId: "listProjectClients",
  path: "/{projectId}",
  tags: ["Client Access"],
  summary: "List a project's client portal accounts",
  description:
    "List the external clients with Service Desk access to a project.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Client accounts with access", clientAccessListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
  },
});

const inviteClientRoute = createRoute({
  method: "post",
  operationId: "inviteProjectClient",
  path: "/{projectId}",
  tags: ["Client Access"],
  summary: "Invite a client to a project's portal",
  description:
    "Grants an external client account access to this project's Service Desk portal, creating the account if it doesn't exist yet. Sends an invite email when SMTP is configured; otherwise the response includes a setup link to share manually.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: inviteClientBody } },
    },
  },
  responses: {
    200: jsonResponse("Client invited", invitedClientResponseSchema),
    400: errorResponse("Invalid body or unknown project"),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
  },
});

const removeClientRoute = createRoute({
  method: "delete",
  operationId: "removeProjectClient",
  path: "/{projectId}/{clientAccountId}",
  tags: ["Client Access"],
  summary: "Revoke a client's access to a project",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: clientAccessParam },
  responses: {
    200: jsonResponse("Client access removed", removedClientAccessSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
    404: errorResponse("Client did not have access to this project"),
  },
});

const clientAccess = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listClientsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await listProjectClients(projectId), 200);
  })
  .openapi(inviteClientRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { email, name } = c.req.valid("json");
    const userId = c.get("userId");
    return c.json(
      await inviteClientToProject(projectId, email, name, userId),
      200,
    );
  })
  .openapi(removeClientRoute, async (c) => {
    const { projectId, clientAccountId } = c.req.valid("param");
    return c.json(await removeProjectClient(projectId, clientAccountId), 200);
  });

export default clientAccess;
