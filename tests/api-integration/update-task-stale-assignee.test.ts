import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Reproduces a real bug found live on kaneo.asygnuz.com: a task mirrored (or
// otherwise created) with an assignee who is not -- or is no longer -- a
// member of the task's workspace becomes permanently stuck. Every edit,
// including a plain drag to another column, re-validates that unrelated,
// unchanged assignee and 403s, so nothing about the task can ever be
// changed again.
async function createTaskWithOutsiderAssignee() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });

  const [outsider] = await db
    .insert(schema.userTable)
    .values({
      id: `outsider-${crypto.randomUUID()}`,
      email: `outsider-${crypto.randomUUID()}@example.com`,
      emailVerified: true,
      name: "Someone from another workspace",
    })
    .returning();
  if (!outsider) throw new Error("failed to seed outsider user");

  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Volver a la cola",
      description: "",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "low",
      number: 1,
      position: 1,
      userId: outsider.id,
    })
    .returning();
  if (!task) throw new Error("failed to seed task");

  return { owner, project, columns, task, outsider };
}

describe("update-task: assignee who is not a workspace member", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("still allows dragging the task to another column without touching the assignee", async () => {
    const { owner, project, columns, task } =
      await createTaskWithOutsiderAssignee();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: task.userId,
        title: task.title,
        description: task.description ?? "",
        status: "in-progress",
        priority: task.priority ?? "no-priority",
        issueType: "task",
        position: 0,
        projectId: project.id,
      }),
    });

    expect(response.status).toBe(200);

    const [updated] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(updated?.status).toBe("in-progress");
    expect(updated?.columnId).toBe(columns.inProgress.id);
    expect(updated?.userId).toBe(task.userId);
  });

  it("still rejects the update if the assignee is actually being changed to a non-member", async () => {
    const { owner, project, task } = await createTaskWithOutsiderAssignee();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "some-other-non-member-id",
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority ?? "no-priority",
        issueType: "task",
        position: 0,
        projectId: project.id,
      }),
    });

    expect(response.status).toBe(403);
  });

  it("still allows clearing the stale assignee", async () => {
    const { owner, project, task } = await createTaskWithOutsiderAssignee();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "",
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority ?? "no-priority",
        issueType: "task",
        position: 0,
        projectId: project.id,
      }),
    });

    expect(response.status).toBe(200);
    const [updated] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(updated?.userId).toBeNull();
  });
});
