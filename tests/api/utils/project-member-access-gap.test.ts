import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

// ASYGNUZ (PR #1, kaneo): a project can be restricted to a subset of
// workspace users via the `project_member` table. Originally that table was
// only consulted by GET /project (the project list, in
// project/controllers/get-projects.ts) — `workspaceAccess.fromProject()`,
// the middleware gating GET /project/:id and every other route that
// resolves access "fromProject"/"fromTask"/"fromColumn"/etc., had no
// concept of project_member at all: it only checked that the caller
// belonged to the *workspace*, not that they were allowed into this
// specific project. That gap is now closed centrally, inside
// workspaceAccessMiddleware itself (via canAccessProject), so every
// consumer of workspaceAccess.from* gets the fix without touching each
// route individually.
//
// This test exercises the real middleware end to end against a mocked data
// layer, proving both directions: a non-member of a restricted project is
// blocked, and a legitimate member (or workspace owner/admin) still gets
// through.

const WORKSPACE_BY_PROJECT: Record<string, string> = {
  "project-restricted": "workspace-mine",
  "project-open": "workspace-mine",
};

const users = new Map<string, { role: string }>();
const workspaceMembers = new Map<string, { role: string }>();
const projectMembers: { projectId: string; userId: string }[] = [];
users.set("just-a-workspace-member", { role: "user" });
workspaceMembers.set("workspace-mine:just-a-workspace-member", {
  role: "member",
});
users.set("the-project-owner", { role: "user" });
workspaceMembers.set("workspace-mine:the-project-owner", { role: "member" });
projectMembers.push({
  projectId: "project-restricted",
  userId: "the-project-owner",
});

vi.mock("../../../apps/api/src/database", async () => {
  const schema = await import("../../../apps/api/src/database/schema");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();

  let currentTable: unknown;

  const chain = {
    select: () => chain,
    from: (table: unknown) => {
      currentTable = table;
      return chain;
    },
    innerJoin: () => chain,
    where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const params = dialect.sqlToQuery(condition).params;
      return {
        limit: async () => {
          if (currentTable === schema.projectTable) {
            const id = params[0] as string;
            const workspaceId = WORKSPACE_BY_PROJECT[id];
            return workspaceId ? [{ workspaceId, projectId: id }] : [];
          }
          if (currentTable === schema.userTable) {
            const user = users.get(params[0] as string);
            return user ? [{ role: user.role }] : [];
          }
          if (currentTable === schema.workspaceUserTable) {
            const [workspaceId, userId] = params as [string, string];
            const member = workspaceMembers.get(`${workspaceId}:${userId}`);
            return member ? [{ role: member.role }] : [];
          }
          if (currentTable === schema.projectMemberTable) {
            if (params.length === 1) {
              const projectId = params[0] as string;
              return projectMembers.some((m) => m.projectId === projectId)
                ? [{ id: "x" }]
                : [];
            }
            const [projectId, userId] = params as [string, string];
            return projectMembers.some(
              (m) => m.projectId === projectId && m.userId === userId,
            )
              ? [{ id: "x" }]
              : [];
          }
          return [];
        },
      };
    },
  };

  return { default: chain, schema };
});

vi.mock("../../../apps/api/src/utils/validate-workspace-access", async () => {
  const { HTTPException } = await import("hono/http-exception");
  return {
    validateWorkspaceAccess: async (_userId: string, workspaceId: string) => {
      if (workspaceId !== "workspace-mine") {
        throw new HTTPException(403, {
          message: "You don't have access to this workspace",
        });
      }
    },
  };
});

const { workspaceAccess } = await import(
  "../../../apps/api/src/utils/workspace-access-middleware"
);

function buildApp(callerUserId: string) {
  return new Hono()
    .use("*", async (c, next) => {
      c.set("userId", callerUserId);
      return next();
    })
    .get("/project/:id", workspaceAccess.fromProject(), async (c) =>
      c.json({ ok: true }),
    );
}

describe("FIXED: project_member restriction is now enforced by workspaceAccess.fromProject()", () => {
  it("blocks a workspace member who is NOT a project_member from a restricted project", async () => {
    const res = await buildApp("just-a-workspace-member").request(
      "/project/project-restricted",
    );
    expect(res.status).toBe(404);
  });

  it("still lets an unrestricted project through for any workspace member", async () => {
    const res = await buildApp("just-a-workspace-member").request(
      "/project/project-open",
    );
    expect(res.status).toBe(200);
  });

  it("still lets the explicit project_member into their own restricted project", async () => {
    const res = await buildApp("the-project-owner").request(
      "/project/project-restricted",
    );
    expect(res.status).toBe(200);
  });
});
