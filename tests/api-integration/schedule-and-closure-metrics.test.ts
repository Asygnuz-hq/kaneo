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

async function seedTask(
  projectId: string,
  columnId: string,
  status: string,
  overrides?: {
    userId?: string | null;
    dueDate?: Date | null;
    number?: number;
  },
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Integration task",
      description: "",
      priority: "low",
      status,
      columnId,
      number: overrides?.number ?? 1,
      position: overrides?.number ?? 1,
      userId: overrides?.userId ?? null,
      dueDate: overrides?.dueDate ?? null,
    })
    .returning();
  return task;
}

async function getCompletedAt(taskId: string) {
  const [row] = await db
    .select({ completedAt: schema.taskTable.completedAt })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, taskId));
  return row?.completedAt ?? null;
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("task completedAt tracking", () => {
  it("stamps completedAt when a task moves into a final column", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id, "to-do");

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    expect(await getCompletedAt(task.id)).toBeNull();

    const response = await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(response.status).toBe(200);

    const completedAt = await getCompletedAt(task.id);
    expect(completedAt).not.toBeNull();
    expect(Date.now() - (completedAt as Date).getTime()).toBeLessThan(5000);
  });

  it("clears completedAt when a task is reopened", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.done.id, "done");
    await db
      .update(schema.taskTable)
      .set({ completedAt: new Date() })
      .where(eq(schema.taskTable.id, task.id));

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "to-do" }),
    });

    expect(await getCompletedAt(task.id)).toBeNull();
  });

  it("keeps the original completedAt when a task is edited while it stays in a final column", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.done.id, "done");
    const originalCompletedAt = new Date("2026-01-01T00:00:00.000Z");
    await db
      .update(schema.taskTable)
      .set({ completedAt: originalCompletedAt })
      .where(eq(schema.taskTable.id, task.id));

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Renamed while done",
        description: "",
        priority: "low",
        status: "done",
        projectId: project.id,
        position: 1,
      }),
    });

    const completedAt = await getCompletedAt(task.id);
    expect(completedAt?.toISOString()).toBe(originalCompletedAt.toISOString());
  });
});

describe("workspace recently-closed report (HU-1)", () => {
  it("returns only tasks closed within the requested window", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    const recent = await seedTask(project.id, columns.done.id, "done", {
      userId: owner.user.id,
      number: 1,
    });
    await db
      .update(schema.taskTable)
      .set({ completedAt: new Date() })
      .where(eq(schema.taskTable.id, recent.id));

    const old = await seedTask(project.id, columns.done.id, "done", {
      number: 2,
    });
    await db
      .update(schema.taskTable)
      .set({
        completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      .where(eq(schema.taskTable.id, old.id));

    await seedTask(project.id, columns.todo.id, "to-do", { number: 3 });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${owner.workspace.id}/recently-closed`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.totalCount).toBe(1);
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].id).toBe(recent.id);
    expect(body.tasks[0].assigneeName).toBe(owner.user.name);
  });
});

describe("workspace upcoming workload (HU-3)", () => {
  it("groups open tasks due within the window by assignee, excluding closed tasks", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    const inWindow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const beyondWindow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await seedTask(project.id, columns.todo.id, "to-do", {
      userId: owner.user.id,
      dueDate: inWindow,
      number: 1,
    });
    await seedTask(project.id, columns.todo.id, "to-do", {
      userId: owner.user.id,
      dueDate: beyondWindow,
      number: 2,
    });
    const closedInWindow = await seedTask(project.id, columns.done.id, "done", {
      userId: owner.user.id,
      dueDate: inWindow,
      number: 3,
    });
    await db
      .update(schema.taskTable)
      .set({ completedAt: new Date() })
      .where(eq(schema.taskTable.id, closedInWindow.id));

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${owner.workspace.id}/upcoming-workload`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.windowDays).toBe(30);
    expect(body.people).toHaveLength(1);
    expect(body.people[0].userId).toBe(owner.user.id);
    expect(body.people[0].taskCount).toBe(1);
  });
});

describe("workspace schedule compliance (HU-4)", () => {
  it("computes on-time percentage and average deviation over dated, closed tasks", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    // Closed 2 days early.
    const early = await seedTask(project.id, columns.done.id, "done", {
      dueDate: new Date("2026-01-10T00:00:00.000Z"),
      number: 1,
    });
    await db
      .update(schema.taskTable)
      .set({ completedAt: new Date("2026-01-08T00:00:00.000Z") })
      .where(eq(schema.taskTable.id, early.id));

    // Closed 4 days late.
    const late = await seedTask(project.id, columns.done.id, "done", {
      dueDate: new Date("2026-01-10T00:00:00.000Z"),
      number: 2,
    });
    await db
      .update(schema.taskTable)
      .set({ completedAt: new Date("2026-01-14T00:00:00.000Z") })
      .where(eq(schema.taskTable.id, late.id));

    // Closed with no dueDate -- must not count toward the measured total.
    const undated = await seedTask(project.id, columns.done.id, "done", {
      number: 3,
    });
    await db
      .update(schema.taskTable)
      .set({ completedAt: new Date() })
      .where(eq(schema.taskTable.id, undated.id));

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${owner.workspace.id}/schedule-compliance`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.totalMeasured).toBe(2);
    expect(body.onTimeCount).toBe(1);
    expect(body.onTimePercentage).toBe(50);
    // (-2 + 4) / 2 = 1 day late on average.
    expect(body.averageDeviationDays).toBe(1);
  });

  it("returns nulls when nothing measurable has closed yet", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await createProjectFixture({ workspaceId: owner.workspace.id });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${owner.workspace.id}/schedule-compliance`,
    );
    const body = await response.json();

    expect(body.totalMeasured).toBe(0);
    expect(body.onTimePercentage).toBeNull();
    expect(body.averageDeviationDays).toBeNull();
  });
});
