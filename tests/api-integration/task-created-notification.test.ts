import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

/**
 * Who hears that a task now exists.
 *
 * The assignee, obviously -- it is their work now. The workspace
 * owner/admin too, even when it is not assigned to them, because they want
 * to know work exists at all rather than discover it on the board later.
 * Nobody is ever told about their own action, even when they wear both hats.
 */

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function addToWorkspace(workspaceId: string, role: string, name: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, emailVerified: true, name })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

// task.created is published without awaiting its subscribers, so the HTTP
// response can land before the notification is actually written.
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

function notificationsFor(userId: string) {
  return db
    .select({ id: schema.notificationTable.id })
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.userId, userId),
        eq(schema.notificationTable.type, "task_created"),
      ),
    );
}

describe("task creation: who gets notified", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("tells the assignee and the owner, but not whoever created it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const member = await addToWorkspace(ws, "member", "Un miembro");
    const { project, columns } = await createProjectFixture({
      workspaceId: ws,
    });
    const { app } = createApp();

    mockAuthenticatedSession(member);
    const response = await app.request(
      `/api/task/${project.id}`,
      json({
        title: "Tarea nueva",
        description: "",
        priority: "low",
        status: columns.todo.slug,
        userId: owner.user.id,
      }),
    );
    expect(response.status).toBe(200);
    await settle();

    expect(await notificationsFor(owner.user.id)).toHaveLength(1);
    expect(await notificationsFor(member.id)).toHaveLength(0);
  });

  it("notifies the owner even when the task is unassigned", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const member = await addToWorkspace(ws, "member", "Un miembro");
    const { project, columns } = await createProjectFixture({
      workspaceId: ws,
    });
    const { app } = createApp();

    mockAuthenticatedSession(member);
    await app.request(
      `/api/task/${project.id}`,
      json({
        title: "Tarea sin asignar",
        description: "",
        priority: "low",
        status: columns.todo.slug,
      }),
    );
    await settle();

    expect(await notificationsFor(owner.user.id)).toHaveLength(1);
  });

  it("does not notify an owner who both created and self-assigned it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const { project, columns } = await createProjectFixture({
      workspaceId: ws,
    });
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    await app.request(
      `/api/task/${project.id}`,
      json({
        title: "La hago yo mismo",
        description: "",
        priority: "low",
        status: columns.todo.slug,
        userId: owner.user.id,
      }),
    );
    await settle();

    expect(await notificationsFor(owner.user.id)).toHaveLength(0);
  });

  it("notifies an admin who created it for someone else exactly once", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const admin = await addToWorkspace(ws, "admin", "Admin también asignado");
    const { project, columns } = await createProjectFixture({
      workspaceId: ws,
    });
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    await app.request(
      `/api/task/${project.id}`,
      json({
        title: "Para el otro admin",
        description: "",
        priority: "low",
        status: columns.todo.slug,
        userId: admin.id,
      }),
    );
    await settle();

    // admin is both the assignee and a workspace lead -- one notification,
    // not two.
    expect(await notificationsFor(admin.id)).toHaveLength(1);
  });
});
