import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createAutomationRule from "./controllers/create-automation-rule";
import deleteAutomationRule from "./controllers/delete-automation-rule";
import listAutomationRules from "./controllers/list-automation-rules";
import updateAutomationRule from "./controllers/update-automation-rule";
import {
  automationRuleListSchema,
  automationRuleSchema,
  removedAutomationRuleSchema,
} from "./response";
import {
  automationRuleParam,
  createAutomationRuleBody,
  projectIdParam,
  updateAutomationRuleBody,
} from "./schema";

const listAutomationRulesRoute = createRoute({
  method: "get",
  operationId: "listAutomationRules",
  path: "/project/{projectId}",
  tags: ["Automation Rules"],
  summary: "List automation rules",
  description:
    "Get every automation rule for a project -- 'when this happens to a task, do that'.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of automation rules", automationRuleListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createAutomationRuleRoute = createRoute({
  method: "post",
  operationId: "createAutomationRule",
  path: "/",
  tags: ["Automation Rules"],
  summary: "Create automation rule",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createAutomationRuleBody } },
    },
  },
  responses: {
    200: jsonResponse("The created rule", automationRuleSchema),
    400: errorResponse(
      "Invalid trigger/action type or config, or unknown project",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateAutomationRuleRoute = createRoute({
  method: "put",
  operationId: "updateAutomationRule",
  path: "/{id}",
  tags: ["Automation Rules"],
  summary: "Update automation rule",
  middleware: [
    workspaceAccess.fromAutomationRule("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: automationRuleParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateAutomationRuleBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated rule", automationRuleSchema),
    400: errorResponse(
      "Invalid trigger/action type or config, or unknown rule",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteAutomationRuleRoute = createRoute({
  method: "delete",
  operationId: "deleteAutomationRule",
  path: "/{id}",
  tags: ["Automation Rules"],
  summary: "Delete automation rule",
  middleware: [
    workspaceAccess.fromAutomationRule("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: automationRuleParam },
  responses: {
    200: jsonResponse("The deleted rule", removedAutomationRuleSchema),
    400: errorResponse("Unknown rule"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const automation = apiRouter()
  .openapi(listAutomationRulesRoute, async (c) =>
    c.json(await listAutomationRules(c.req.valid("param").projectId), 200),
  )
  .openapi(createAutomationRuleRoute, async (c) => {
    const {
      projectId,
      name,
      triggerType,
      triggerConfig,
      actionType,
      actionConfig,
    } = c.req.valid("json");
    return c.json(
      await createAutomationRule({
        projectId,
        name,
        triggerType,
        triggerConfig,
        actionType,
        actionConfig,
      }),
      200,
    );
  })
  .openapi(updateAutomationRuleRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(await updateAutomationRule({ id, ...body }), 200);
  })
  .openapi(deleteAutomationRuleRoute, async (c) =>
    c.json(await deleteAutomationRule(c.req.valid("param").id), 200),
  );

export default automation;
