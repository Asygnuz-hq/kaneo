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
 * Editing a task rings for whoever is doing it, and never for the person who
 * just made the edit. A burst of edits rings once.
 */

const put = (body: unknown) => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function addMember(workspaceId: string, name: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, emailVerified: true, name })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role: "member",
    joinedAt: new Date(),
  });
  return user;
}

// Event subscribers run un-awaited, so the response can beat the write.
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

function updatesFor(userId: string) {
  return db
    .select({ eventData: schema.notificationTable.eventData })
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.userId, userId),
        eq(schema.notificationTable.type, "task_updated"),
      ),
    );
}

async function seedTask() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const assignee = await addMember(ws, "Quien hace");
  const { project, columns } = await createProjectFixture({ workspaceId: ws });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Tarea de prueba",
      description: "",
      priority: "low",
      status: columns.todo.slug,
      columnId: columns.todo.id,
      number: 1,
      position: 1,
      userId: assignee.id,
    })
    .returning();
  if (!task) throw new Error("seed failed");
  return { owner, assignee, task };
}

describe("task edits: who gets notified", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("tells the assignee, not whoever edited", async () => {
    const { owner, assignee, task } = await seedTask();
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    const response = await app.request(
      `/api/task/priority/${task.id}`,
      put({ priority: "high" }),
    );
    expect(response.status).toBe(200);
    await settle();

    expect(await updatesFor(assignee.id)).toHaveLength(1);
    expect(await updatesFor(owner.user.id)).toHaveLength(0);
  });

  it("does not notify the assignee about their own edit", async () => {
    const { assignee, task } = await seedTask();
    const { app } = createApp();

    mockAuthenticatedSession(assignee);
    await app.request(`/api/task/title/${task.id}`, put({ title: "Otro" }));
    await settle();

    expect(await updatesFor(assignee.id)).toHaveLength(0);
  });

  it("rings once for a burst of edits to the same task", async () => {
    const { owner, assignee, task } = await seedTask();
    const { app } = createApp();

    mockAuthenticatedSession(owner.user);
    await app.request(
      `/api/task/priority/${task.id}`,
      put({ priority: "high" }),
    );
    await settle();
    await app.request(`/api/task/title/${task.id}`, put({ title: "Nuevo" }));
    await settle();

    expect(await updatesFor(assignee.id)).toHaveLength(1);
  });
});
