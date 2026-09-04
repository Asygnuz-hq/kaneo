import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: goals", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "missing", title: "Ship v2" }),
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

    const response = await app.request("/api/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Ship v2" }),
    });

    expect(response.status).toBe(403);
  });

  it("creates a goal with zeroed progress for a workspace admin", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Ship v2",
        description: "Get v2 out the door",
        status: "on-track",
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      projectId: project.id,
      title: "Ship v2",
      status: "on-track",
      linkedTaskCount: 0,
      completedTaskCount: 0,
    });
  });

  it("rejects an invalid status", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Ship v2",
        status: "not-a-status",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a duplicate title in the same project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    await db.insert(schema.goalTable).values({
      projectId: project.id,
      title: "Ship v2",
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Ship v2" }),
    });

    expect(response.status).toBe(400);
  });

  it("lists, updates and deletes a goal", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [goal] = await db
      .insert(schema.goalTable)
      .values({ projectId: project.id, title: "Ship v2" })
      .returning();
    if (!goal) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const listResponse = await app.request(`/api/goal/project/${project.id}`);
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toHaveLength(1);

    const updateResponse = await app.request(`/api/goal/${goal.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "at-risk", title: "Ship v2.1" }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({
      status: "at-risk",
      title: "Ship v2.1",
    });

    const deleteResponse = await app.request(`/api/goal/${goal.id}`, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(200);

    const secondDelete = await app.request(`/api/goal/${goal.id}`, {
      method: "DELETE",
    });
    expect(secondDelete.status).toBe(400);
  });

  it("links tasks to a goal and computes progress from completed ones", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [goal] = await db
      .insert(schema.goalTable)
      .values({ projectId: project.id, title: "Ship v2" })
      .returning();
    if (!goal) throw new Error("seed failed");

    const [openTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Open task",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();
    const [doneTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Done task",
        status: "done",
        columnId: columns.done.id,
        number: 2,
        position: 2,
      })
      .returning();
    if (!openTask || !doneTask) throw new Error("seed failed");

    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    for (const task of [openTask, doneTask]) {
      const linkResponse = await app.request(`/api/goal/${goal.id}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      expect(linkResponse.status).toBe(200);
    }

    const tasksResponse = await app.request(`/api/goal/${goal.id}/tasks`);
    expect(tasksResponse.status).toBe(200);
    const linkedTasks = await tasksResponse.json();
    expect(linkedTasks).toHaveLength(2);
    expect(
      linkedTasks.find((t: { id: string }) => t.id === doneTask.id)?.isDone,
    ).toBe(true);
    expect(
      linkedTasks.find((t: { id: string }) => t.id === openTask.id)?.isDone,
    ).toBe(false);

    const listResponse = await app.request(`/api/goal/project/${project.id}`);
    const goals = await listResponse.json();
    expect(goals[0]).toMatchObject({
      linkedTaskCount: 2,
      completedTaskCount: 1,
    });

    const unlinkResponse = await app.request(
      `/api/goal/${goal.id}/tasks/${openTask.id}`,
      { method: "DELETE" },
    );
    expect(unlinkResponse.status).toBe(200);

    const secondUnlink = await app.request(
      `/api/goal/${goal.id}/tasks/${openTask.id}`,
      { method: "DELETE" },
    );
    expect(secondUnlink.status).toBe(404);
  });

  it("rejects linking a task from a different project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const { project: otherProject, columns: otherColumns } =
      await createProjectFixture({
        workspaceId: admin.workspace.id,
        name: "Other project",
        slug: "other-project-goal",
      });
    const [goal] = await db
      .insert(schema.goalTable)
      .values({ projectId: project.id, title: "Ship v2" })
      .returning();
    const [otherTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: otherProject.id,
        title: "Task in other project",
        status: "to-do",
        columnId: otherColumns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();
    if (!goal || !otherTask) throw new Error("seed failed");

    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/goal/${goal.id}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: otherTask.id }),
    });

    expect(response.status).toBe(400);
  });

  it("lists available tasks for a project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Some task",
      status: "to-do",
      columnId: columns.todo.id,
      number: 1,
      position: 1,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/goal/project/${project.id}/available-tasks`,
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({ title: "Some task" });
  });
});
