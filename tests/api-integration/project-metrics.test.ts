import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: project metrics", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated requests", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/project-metrics/missing");

    expect(response.status).toBe(401);
  });

  it("rejects a user outside the project's workspace", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(`/api/project-metrics/${project.id}`);

    expect(response.status).toBe(403);
  });

  it("returns zeroed metrics for a project with no tasks", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/project-metrics/${project.id}`);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      statusCounts: [],
      priorityCounts: [],
      workload: [],
    });
  });

  it("aggregates status, priority, overdue, completed and per-assignee workload", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Assignee A: one open+overdue task, one done task (not counted overdue
    // since it's already in the final column).
    await db.insert(schema.taskTable).values([
      {
        projectId: project.id,
        userId: member.user.id,
        title: "Overdue task",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "high",
        dueDate: yesterday,
        number: 1,
        position: 1,
      },
      {
        projectId: project.id,
        userId: member.user.id,
        title: "Done task",
        status: "done",
        columnId: columns.done.id,
        priority: "low",
        dueDate: yesterday,
        number: 2,
        position: 2,
      },
      {
        projectId: project.id,
        userId: null,
        title: "Unassigned upcoming task",
        status: "in-progress",
        columnId: columns.inProgress.id,
        priority: "high",
        dueDate: tomorrow,
        number: 3,
        position: 3,
      },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/project-metrics/${project.id}`);
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.totalTasks).toBe(3);
    expect(payload.completedTasks).toBe(1);
    expect(payload.overdueTasks).toBe(1);

    const priorityMap = Object.fromEntries(
      payload.priorityCounts.map((p: { priority: string; count: number }) => [
        p.priority,
        p.count,
      ]),
    );
    expect(priorityMap).toMatchObject({ high: 2, low: 1 });

    const statusMap = Object.fromEntries(
      payload.statusCounts.map((s: { status: string; count: number }) => [
        s.status,
        s.count,
      ]),
    );
    expect(statusMap).toMatchObject({
      "to-do": 1,
      done: 1,
      "in-progress": 1,
    });

    const memberWorkload = payload.workload.find(
      (w: { userId: string | null }) => w.userId === member.user.id,
    );
    expect(memberWorkload).toMatchObject({ openCount: 1, totalCount: 2 });

    const unassignedWorkload = payload.workload.find(
      (w: { userId: string | null }) => w.userId === null,
    );
    expect(unassignedWorkload).toMatchObject({ openCount: 1, totalCount: 1 });
  });
});
