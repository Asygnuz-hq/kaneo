import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createExternalContact from "./controllers/create-external-contact";
import deleteExternalContact from "./controllers/delete-external-contact";
import listExternalContacts from "./controllers/list-external-contacts";
import {
  externalContactListSchema,
  externalContactSchema,
  removedExternalContactSchema,
} from "./response";
import {
  createExternalContactBody,
  externalContactParam,
  workspaceIdParam,
} from "./schema";

// ASYGNUZ: Contactos Externos -- personas sin cuenta de Kaneo que igual
// pueden marcarse como responsables de una tarea (ver el comentario en
// database/schema.ts). Administrar la lista (crear/borrar un contacto)
// requiere manage_settings, igual que los custom fields: es configuración
// del workspace, no el día a día de una tarea puntual.

const listExternalContactsRoute = createRoute({
  method: "get",
  operationId: "listExternalContacts",
  path: "/workspace/{workspaceId}",
  tags: ["External Contacts"],
  summary: "List a workspace's external contacts",
  middleware: [workspaceAccess.fromParam()] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "External contacts in the workspace",
      externalContactListSchema,
    ),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const createExternalContactRoute = createRoute({
  method: "post",
  operationId: "createExternalContact",
  path: "/",
  tags: ["External Contacts"],
  summary: "Create an external contact",
  description:
    "Create a new external contact in a workspace -- a person without a Kaneo account who can still be marked as responsible for a task.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createExternalContactBody } },
    },
  },
  responses: {
    200: jsonResponse("External contact created", externalContactSchema),
    400: errorResponse(
      "Invalid body, duplicate name, or workspace ID could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
  },
});

const deleteExternalContactRoute = createRoute({
  method: "delete",
  operationId: "deleteExternalContact",
  path: "/{id}",
  tags: ["External Contacts"],
  summary: "Delete an external contact",
  description:
    "Delete an external contact. Every task it was marked on loses that assignment too (cascade) -- there's no undo.",
  middleware: [
    workspaceAccess.fromExternalContact(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: externalContactParam },
  responses: {
    200: jsonResponse("External contact deleted", removedExternalContactSchema),
    400: errorResponse(
      "Unknown external contact, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
    404: errorResponse("External contact not found"),
  },
});

const externalContact = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listExternalContactsRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await listExternalContacts(workspaceId), 200);
  })
  .openapi(createExternalContactRoute, async (c) => {
    const { workspaceId, name } = c.req.valid("json");
    return c.json(await createExternalContact(workspaceId, name), 200);
  })
  .openapi(deleteExternalContactRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await deleteExternalContact(id), 200);
  });

export default externalContact;
