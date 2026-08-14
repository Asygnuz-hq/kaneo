import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import addProjectMemberCtrl from "./controllers/add-project-member";
import listProjectMembersCtrl from "./controllers/list-project-members";
import removeProjectMemberCtrl from "./controllers/remove-project-member";

const memberSchema = v.object({
  id: v.string(),
  userId: v.string(),
  name: v.string(),
  email: v.string(),
  createdAt: v.date(),
});

// ASYGNUZ: control de acceso por proyecto. Administrar quién ve qué proyecto
// requiere el mismo permiso que administrar el workspace (owner/admin) — ver
// packages/permissions: solo esos roles traen "manage_settings".
const projectMember = new Hono<{
  Variables: { userId: string; workspaceId: string };
}>()
  .get(
    "/:projectId",
    describeRoute({
      operationId: "listProjectMembers",
      tags: ["Project Members"],
      description:
        "List the users explicitly granted access to a project (ASYGNUZ)",
      responses: {
        200: {
          description: "Project members",
          content: {
            "application/json": { schema: resolver(v.array(memberSchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await listProjectMembersCtrl(projectId));
    },
  )
  .post(
    "/:projectId",
    describeRoute({
      operationId: "addProjectMember",
      tags: ["Project Members"],
      description:
        "Grant a workspace user access to a project (ASYGNUZ). Once a project has at least one member, only its members (plus workspace owner/admin) can see it.",
      responses: {
        200: {
          description: "Member added",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator("json", v.object({ userId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { userId } = c.req.valid("json");
      return c.json(await addProjectMemberCtrl(projectId, userId));
    },
  )
  .delete(
    "/:projectId/:userId",
    describeRoute({
      operationId: "removeProjectMember",
      tags: ["Project Members"],
      description: "Revoke a user's explicit access to a project (ASYGNUZ)",
      responses: {
        200: {
          description: "Member removed",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string(), userId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const { projectId, userId } = c.req.valid("param");
      return c.json(await removeProjectMemberCtrl(projectId, userId));
    },
  );

export default projectMember;
