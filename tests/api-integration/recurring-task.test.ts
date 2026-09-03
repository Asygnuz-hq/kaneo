import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { checkRecurringTasks } from "../../apps/api/src/scheduler/recurring-tasks";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: recurring tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/recurring-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "missing",
        name: "Weekly sync",
        title: "Weekly sync",
        frequency: "weekly",
        startAt: new Date().toISOString(),
      }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects creation for a member without project:update", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/recurring-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Weekly sync",
        title: "Weekly sync",
        frequency: "weekly",
        startAt: new Date().toISOString(),
      }),
    });

    expect(response.status).toBe(403);
  });

  it("creates a recurring task for a workspace admin", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const startAt = new Date("2026-08-01T09:00:00.000Z").toISOString();
    const response = await app.request("/api/recurring-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Weekly sync",
        title: "Team sync",
        description: "Standing weekly sync",
        priority: "medium",
        frequency: "weekly",
        startAt,
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      projectId: project.id,
      name: "Weekly sync",
      title: "Team sync",
      priority: "medium",
      frequency: "weekly",
      isActive: true,
      labelIds: [],
    });
    expect(new Date(payload.nextRunAt).toISOString()).toBe(startAt);
  });

  it("rejects an unknown frequency", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/recurring-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Bad",
        title: "Bad",
        frequency: "hourly",
        startAt: new Date().toISOString(),
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a duplicate name in the same project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    await db.insert(schema.recurringTaskTable).values({
      projectId: project.id,
      name: "Weekly sync",
      title: "Team sync",
      frequency: "weekly",
      nextRunAt: new Date(),
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/recurring-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Weekly sync",
        title: "Another",
        frequency: "daily",
        startAt: new Date().toISOString(),
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects an assignee outside the workspace", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const outsiderId = "user-recurring-outsider";
    await db.insert(schema.userTable).values({
      id: outsiderId,
      email: `${outsiderId}@example.com`,
      emailVerified: true,
      name: "Outsider",
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/recurring-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Weekly sync",
        title: "Team sync",
        frequency: "weekly",
        startAt: new Date().toISOString(),
        assigneeId: outsiderId,
      }),
    });

    expect(response.status).toBe(403);
  });

  it("lists, updates, and deletes a recurring task", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [recurringTask] = await db
      .insert(schema.recurringTaskTable)
      .values({
        projectId: project.id,
        name: "Weekly sync",
        title: "Team sync",
        frequency: "weekly",
        nextRunAt: new Date(),
      })
      .returning();
    if (!recurringTask) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const listResponse = await app.request(
      `/api/recurring-task/project/${project.id}`,
    );
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toHaveLength(1);

    const updateResponse = await app.request(
      `/api/recurring-task/${recurringTask.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false, title: "Renamed sync" }),
      },
    );
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({
      isActive: false,
      title: "Renamed sync",
    });

    const deleteResponse = await app.request(
      `/api/recurring-task/${recurringTask.id}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(200);

    const secondDelete = await app.request(
      `/api/recurring-task/${recurringTask.id}`,
      { method: "DELETE" },
    );
    expect(secondDelete.status).toBe(400);
  });

  it("creates a task and advances nextRunAt when the scheduler finds a due recurring task", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Recurring",
        color: "#00ff00",
        workspaceId: admin.workspace.id,
      })
      .returning();
    if (!label) throw new Error("seed failed");

    const pastDue = new Date(Date.now() - 60 * 60 * 1000); // an hour ago
    const [recurringTask] = await db
      .insert(schema.recurringTaskTable)
      .values({
        projectId: project.id,
        name: "Daily standup",
        title: "Daily standup notes",
        description: "Fill in yesterday/today/blockers",
        priority: "high",
        issueType: "task",
        labelIds: JSON.stringify([label.id]),
        assigneeId: admin.user.id,
        frequency: "daily",
        nextRunAt: pastDue,
      })
      .returning();
    if (!recurringTask) throw new Error("seed failed");

    const result = await checkRecurringTasks();
    expect(result.degraded).toBe(false);

    const createdTask = await db.query.taskTable.findFirst({
      where: (task, { eq: eqOp }) => eqOp(task.title, "Daily standup notes"),
    });
    expect(createdTask).toMatchObject({
      projectId: project.id,
      priority: "high",
      userId: admin.user.id,
      status: columns.todo.slug,
    });

    const taskLabels = await db.query.labelTable.findMany({
      where: (l, { eq: eqOp }) => eqOp(l.taskId, createdTask?.id ?? ""),
    });
    expect(taskLabels.map((l) => l.name)).toContain("Recurring");

    const updatedRecurringTask = await db.query.recurringTaskTable.findFirst({
      where: eq(schema.recurringTaskTable.id, recurringTask.id),
    });
    expect(updatedRecurringTask?.nextRunAt.getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(updatedRecurringTask?.lastRunAt).not.toBeNull();
  });

  it("does not create a task for an inactive recurring task", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    await db.insert(schema.recurringTaskTable).values({
      projectId: project.id,
      name: "Disabled",
      title: "Should not appear",
      frequency: "daily",
      isActive: false,
      nextRunAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    await checkRecurringTasks();

    const createdTask = await db.query.taskTable.findFirst({
      where: (task, { eq: eqOp }) => eqOp(task.title, "Should not appear"),
    });
    expect(createdTask).toBeUndefined();
  });
});
