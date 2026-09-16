import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: workspace workload", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated requests", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      "/api/project-metrics/workspace/missing",
    );

    expect(response.status).toBe(401);
  });

  it("rejects a user outside the workspace", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${member.workspace.id}`,
    );

    expect(response.status).toBe(403);
  });

  it("returns zeroed metrics for a workspace with no tasks", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${member.workspace.id}`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      totalOpenTasks: 0,
      totalOverdueTasks: 0,
      workload: [],
    });
  });

  it("sums a person's workload across every project in the workspace, broken down by project", async () => {
    const member = await createWorkspaceMember();
    const { project: projectA, columns: columnsA } = await createProjectFixture(
      { workspaceId: member.workspace.id, name: "Project A" },
    );
    const { project: projectB, columns: columnsB } = await createProjectFixture(
      { workspaceId: member.workspace.id, name: "Project B" },
    );

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(schema.taskTable).values([
      // Project A: one open+overdue task, one done task for the same person.
      {
        projectId: projectA.id,
        userId: member.user.id,
        title: "Overdue in A",
        status: "to-do",
        columnId: columnsA.todo.id,
        priority: "high",
        dueDate: yesterday,
        number: 1,
        position: 1,
      },
      {
        projectId: projectA.id,
        userId: member.user.id,
        title: "Done in A",
        status: "done",
        columnId: columnsA.done.id,
        priority: "low",
        dueDate: yesterday,
        number: 2,
        position: 2,
      },
      // Project B: one more open task for the SAME person, plus an
      // unassigned task — this is the cross-project aggregation this
      // endpoint exists for.
      {
        projectId: projectB.id,
        userId: member.user.id,
        title: "Open in B",
        status: "in-progress",
        columnId: columnsB.inProgress.id,
        priority: "high",
        dueDate: tomorrow,
        number: 1,
        position: 1,
      },
      {
        projectId: projectB.id,
        userId: null,
        title: "Unassigned in B",
        status: "to-do",
        columnId: columnsB.todo.id,
        priority: "medium",
        dueDate: null,
        number: 2,
        position: 2,
      },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${member.workspace.id}`,
    );
    expect(response.status).toBe(200);
    const payload = await response.json();

    // Open tasks workspace-wide: overdue-in-A + open-in-B + unassigned-in-B.
    expect(payload.totalOpenTasks).toBe(3);
    expect(payload.totalOverdueTasks).toBe(1);

    const memberWorkload = payload.workload.find(
      (w: { userId: string | null }) => w.userId === member.user.id,
    );
    expect(memberWorkload).toMatchObject({
      openCount: 2,
      totalCount: 3,
      overdueCount: 1,
    });

    const byProject = Object.fromEntries(
      memberWorkload.byProject.map(
        (p: { projectName: string; openCount: number; totalCount: number }) => [
          p.projectName,
          { openCount: p.openCount, totalCount: p.totalCount },
        ],
      ),
    );
    expect(byProject).toMatchObject({
      "Project A": { openCount: 1, totalCount: 2 },
      "Project B": { openCount: 1, totalCount: 1 },
    });

    const unassignedWorkload = payload.workload.find(
      (w: { userId: string | null }) => w.userId === null,
    );
    expect(unassignedWorkload).toMatchObject({
      openCount: 1,
      totalCount: 1,
      overdueCount: 0,
    });
  });

  it("excludes archived projects from the workspace workload", async () => {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    await db.insert(schema.taskTable).values({
      projectId: project.id,
      userId: member.user.id,
      title: "Task in an archived project",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      dueDate: null,
      number: 1,
      position: 1,
    });

    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, project.id));

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-metrics/workspace/${member.workspace.id}`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      totalOpenTasks: 0,
      totalOverdueTasks: 0,
      workload: [],
    });
  });
});
