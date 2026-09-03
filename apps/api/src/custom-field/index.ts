import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createCustomField from "./controllers/create-custom-field";
import deleteCustomField from "./controllers/delete-custom-field";
import listCustomFields from "./controllers/list-custom-fields";
import listTaskCustomFieldValues from "./controllers/list-task-custom-field-values";
import setTaskCustomFieldValue from "./controllers/set-task-custom-field-value";
import unsetTaskCustomFieldValue from "./controllers/unset-task-custom-field-value";
import updateCustomField from "./controllers/update-custom-field";
import {
  customFieldListSchema,
  customFieldSchema,
  removedCustomFieldSchema,
  removedTaskCustomFieldValueSchema,
  taskCustomFieldValueListSchema,
  taskCustomFieldValueSchema,
} from "./response";
import {
  createCustomFieldBody,
  customFieldParam,
  setTaskCustomFieldValueBody,
  taskCustomFieldValueParam,
  taskIdParam,
  updateCustomFieldBody,
  workspaceIdParam,
} from "./schema";

// ASYGNUZ: Campos Personalizados. Definidos a nivel de workspace (no de
// proyecto) -- ver el comentario en database/schema.ts. Administrar las
// definiciones (crear/editar/borrar un campo) requiere manage_settings,
// igual que administrar clientes del portal o miembros de proyecto: es una
// decisión de configuración del workspace, no del día a día de una tarea.
// Fijar/quitar el VALOR de un campo en una tarea puntual solo requiere
// poder editar esa tarea (task:update).

const listCustomFieldsRoute = createRoute({
  method: "get",
  operationId: "listCustomFields",
  path: "/workspace/{workspaceId}",
  tags: ["Custom Fields"],
  summary: "List a workspace's custom field definitions",
  middleware: [workspaceAccess.fromParam()] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Custom fields in the workspace", customFieldListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const createCustomFieldRoute = createRoute({
  method: "post",
  operationId: "createCustomField",
  path: "/",
  tags: ["Custom Fields"],
  summary: "Create a custom field",
  description:
    "Create a new custom field definition in a workspace. Available to every project in that workspace.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createCustomFieldBody } },
    },
  },
  responses: {
    200: jsonResponse("Custom field created", customFieldSchema),
    400: errorResponse(
      "Invalid body, duplicate name, or workspace ID could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
  },
});

const updateCustomFieldRoute = createRoute({
  method: "put",
  operationId: "updateCustomField",
  path: "/{id}",
  tags: ["Custom Fields"],
  summary: "Update a custom field",
  description:
    "Update a custom field's name and options. The type is fixed at creation and cannot be changed -- every value already stored for this field was validated against the original type's rules.",
  middleware: [
    workspaceAccess.fromCustomField(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: customFieldParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateCustomFieldBody } },
    },
  },
  responses: {
    200: jsonResponse("Custom field updated", customFieldSchema),
    400: errorResponse("Invalid body, duplicate name, or unknown field"),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
    404: errorResponse("Custom field not found"),
  },
});

const deleteCustomFieldRoute = createRoute({
  method: "delete",
  operationId: "deleteCustomField",
  path: "/{id}",
  tags: ["Custom Fields"],
  summary: "Delete a custom field",
  description:
    "Delete a custom field definition. Every task's stored value for it is deleted too (cascade) -- there's no undo.",
  middleware: [
    workspaceAccess.fromCustomField(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: customFieldParam },
  responses: {
    200: jsonResponse("Custom field deleted", removedCustomFieldSchema),
    400: errorResponse(
      "Unknown custom field, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing manage_settings permission",
    ),
    404: errorResponse("Custom field not found"),
  },
});

const listTaskCustomFieldValuesRoute = createRoute({
  method: "get",
  operationId: "listTaskCustomFieldValues",
  path: "/task/{taskId}",
  tags: ["Custom Fields"],
  summary: "List a task's custom field values",
  description:
    "List the custom field values a task actually has set. A field with nothing entered for this task simply has no row here -- join against GET /custom-field/workspace/{workspaceId} client-side for the full set of fields plus their values.",
  middleware: [workspaceAccess.fromTaskId()] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse(
      "Custom field values for the task",
      taskCustomFieldValueListSchema,
    ),
    400: errorResponse(
      "Unknown task, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the task's workspace"),
  },
});

const setTaskCustomFieldValueRoute = createRoute({
  method: "put",
  operationId: "setTaskCustomFieldValue",
  path: "/task/{taskId}/{customFieldId}",
  tags: ["Custom Fields"],
  summary: "Set a task's custom field value",
  description:
    "Set (or overwrite) a task's value for a custom field. The value must be valid for the field's type -- see custom-field/coerce-value.ts.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: taskCustomFieldValueParam,
    body: {
      required: true,
      content: { "application/json": { schema: setTaskCustomFieldValueBody } },
    },
  },
  responses: {
    200: jsonResponse("Value set", taskCustomFieldValueSchema),
    400: errorResponse(
      "Invalid value for this field's type, or the field doesn't belong to the task's workspace",
    ),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("Task or custom field not found"),
  },
});

const unsetTaskCustomFieldValueRoute = createRoute({
  method: "delete",
  operationId: "unsetTaskCustomFieldValue",
  path: "/task/{taskId}/{customFieldId}",
  tags: ["Custom Fields"],
  summary: "Unset a task's custom field value",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: taskCustomFieldValueParam },
  responses: {
    200: jsonResponse("Value unset", removedTaskCustomFieldValueSchema),
    400: errorResponse(
      "Unknown task, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("This task has no value set for that custom field"),
  },
});

const customField = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listCustomFieldsRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await listCustomFields(workspaceId), 200);
  })
  .openapi(createCustomFieldRoute, async (c) => {
    const { workspaceId, name, type, options } = c.req.valid("json");
    return c.json(
      await createCustomField(workspaceId, name, type, options),
      200,
    );
  })
  .openapi(updateCustomFieldRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { name, options } = c.req.valid("json");
    return c.json(await updateCustomField(id, name, options), 200);
  })
  .openapi(deleteCustomFieldRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await deleteCustomField(id), 200);
  })
  .openapi(listTaskCustomFieldValuesRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    return c.json(await listTaskCustomFieldValues(taskId), 200);
  })
  .openapi(setTaskCustomFieldValueRoute, async (c) => {
    const { taskId, customFieldId } = c.req.valid("param");
    const { value } = c.req.valid("json");
    return c.json(
      await setTaskCustomFieldValue(taskId, customFieldId, value),
      200,
    );
  })
  .openapi(unsetTaskCustomFieldValueRoute, async (c) => {
    const { taskId, customFieldId } = c.req.valid("param");
    return c.json(await unsetTaskCustomFieldValue(taskId, customFieldId), 200);
  });

export default customField;
