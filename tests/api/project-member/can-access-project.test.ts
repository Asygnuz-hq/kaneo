import { describe, expect, it, vi } from "vitest";

// ASYGNUZ: canAccessProject() es la única fuente de verdad para "¿puede este
// usuario ver este proyecto?" — la usan tanto el listado (GET /project) como
// el middleware que protege cada recurso individual (workspaceAccessMiddleware).
// Este test ejercita directamente el código real contra un mock de la capa de
// datos, sin necesitar Postgres.

type Row = Record<string, unknown>;

const users = new Map<string, { role: string }>();
const workspaceMembers = new Map<string, { role: string }>();
const projectMembers: { projectId: string; userId: string }[] = [];

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
    where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const params = dialect.sqlToQuery(condition).params;
      return {
        limit: async (): Promise<Row[]> => {
          if (currentTable === schema.userTable) {
            const userId = params[0] as string;
            const user = users.get(userId);
            return user ? [{ role: user.role }] : [];
          }
          if (currentTable === schema.workspaceUserTable) {
            const [workspaceId, userId] = params as [string, string];
            const member = workspaceMembers.get(`${workspaceId}:${userId}`);
            return member ? [{ role: member.role }] : [];
          }
          if (currentTable === schema.projectMemberTable) {
            if (params.length === 1) {
              // "¿tiene este proyecto algún member?"
              const projectId = params[0] as string;
              const any = projectMembers.some((m) => m.projectId === projectId);
              return any ? [{ id: "x" }] : [];
            }
            // "¿es ESTE usuario member de este proyecto?"
            const [projectId, userId] = params as [string, string];
            const match = projectMembers.some(
              (m) => m.projectId === projectId && m.userId === userId,
            );
            return match ? [{ id: "x" }] : [];
          }
          return [];
        },
      };
    },
  };

  return { default: chain, schema };
});

const { canAccessProject, bypassesProjectFilter } = await import(
  "../../../apps/api/src/project-member/utils/can-access-project"
);

describe("canAccessProject", () => {
  it("deja pasar a un instance admin aunque no sea member del proyecto", async () => {
    users.set("admin-1", { role: "admin" });
    projectMembers.push({
      projectId: "proj-restricted",
      userId: "someone-else",
    });

    expect(await canAccessProject("proj-restricted", "ws-1", "admin-1")).toBe(
      true,
    );
  });

  it("deja pasar al owner/admin del workspace aunque no sea member del proyecto", async () => {
    users.set("owner-1", { role: "user" });
    workspaceMembers.set("ws-1:owner-1", { role: "owner" });

    expect(await canAccessProject("proj-restricted", "ws-1", "owner-1")).toBe(
      true,
    );
  });

  it("deja pasar a cualquiera si el proyecto no tiene ningún project_member (sin restringir)", async () => {
    users.set("random-1", { role: "user" });
    workspaceMembers.set("ws-1:random-1", { role: "member" });

    expect(await canAccessProject("proj-open", "ws-1", "random-1")).toBe(true);
  });

  it("bloquea a un member del workspace que NO está en project_member de un proyecto restringido — el hueco reportado", async () => {
    users.set("outsider-1", { role: "user" });
    workspaceMembers.set("ws-1:outsider-1", { role: "member" });
    projectMembers.push({
      projectId: "proj-restricted-2",
      userId: "insider-1",
    });

    expect(
      await canAccessProject("proj-restricted-2", "ws-1", "outsider-1"),
    ).toBe(false);
  });

  it("deja pasar al usuario que SÍ está explícitamente en project_member", async () => {
    users.set("insider-2", { role: "user" });
    workspaceMembers.set("ws-1:insider-2", { role: "member" });
    projectMembers.push({
      projectId: "proj-restricted-3",
      userId: "insider-2",
    });

    expect(
      await canAccessProject("proj-restricted-3", "ws-1", "insider-2"),
    ).toBe(true);
  });

  it("bypassesProjectFilter: false para un member normal sin rol especial", async () => {
    users.set("plain-1", { role: "user" });
    workspaceMembers.set("ws-1:plain-1", { role: "member" });

    expect(await bypassesProjectFilter("ws-1", "plain-1")).toBe(false);
  });
});
