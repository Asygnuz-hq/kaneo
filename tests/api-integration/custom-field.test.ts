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

async function createTaskFixture(
  projectId: string,
  columnId: string,
  userId: string,
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      userId,
      title: "Custom field test task",
      status: "to-do",
      columnId,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();
  return task;
}

describe("API integration: custom fields", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated field creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "workspace-missing",
        name: "Priority",
        type: "text",
      }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects field creation by a plain member (missing manage_settings)", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        name: "Client priority",
        type: "text",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("creates a text field as a workspace admin", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client priority",
        type: "text",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id: string; options: null };
    expect(payload.options).toBeNull();

    const persisted = await db.query.customFieldTable.findFirst({
      where: eq(schema.customFieldTable.id, payload.id),
    });
    expect(persisted).toMatchObject({
      workspaceId: admin.workspace.id,
      name: "Client priority",
      type: "text",
      options: null,
      position: 0,
    });
  });

  it("creates a select field with options", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client tier",
        type: "select",
        options: ["Gold", "Silver", "Bronze"],
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { options: string[] };
    expect(payload.options).toEqual(["Gold", "Silver", "Bronze"]);
  });

  it("rejects a select field with no options", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client tier",
        type: "select",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a non-select field that sends options", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client priority",
        type: "text",
        options: ["A", "B"],
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a duplicate field name in the same workspace", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client priority",
        type: "text",
      }),
    });
    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client priority",
        type: "number",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("lists a workspace's fields ordered by position", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    for (const name of ["First", "Second", "Third"]) {
      await app.request("/api/custom-field", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: admin.workspace.id,
          name,
          type: "text",
        }),
      });
    }

    const response = await app.request(
      `/api/custom-field/workspace/${admin.workspace.id}`,
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { name: string }[];
    expect(payload.map((f) => f.name)).toEqual(["First", "Second", "Third"]);
  });

  it("updates a field's name and options, rejecting a duplicate name", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const createResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client tier",
        type: "select",
        options: ["Gold", "Silver"],
      }),
    });
    const field = (await createResponse.json()) as { id: string };

    const updateResponse = await app.request(`/api/custom-field/${field.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Client tier",
        options: ["Gold", "Silver", "Bronze"],
      }),
    });
    expect(updateResponse.status).toBe(200);
    const updated = (await updateResponse.json()) as { options: string[] };
    expect(updated.options).toEqual(["Gold", "Silver", "Bronze"]);

    await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Other field",
        type: "text",
      }),
    });
    const conflictResponse = await app.request(
      `/api/custom-field/${field.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Other field" }),
      },
    );
    expect(conflictResponse.status).toBe(400);
  });

  it("deletes a field and cascades to its task values", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await createTaskFixture(
      project.id,
      columns.todo.id,
      admin.user.id,
    );
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const createResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client priority",
        type: "text",
      }),
    });
    const field = (await createResponse.json()) as { id: string };

    await app.request(`/api/custom-field/task/${task.id}/${field.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "High" }),
    });

    const deleteResponse = await app.request(`/api/custom-field/${field.id}`, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(200);

    const remainingValues = await db.query.taskCustomFieldValueTable.findMany({
      where: eq(schema.taskCustomFieldValueTable.customFieldId, field.id),
    });
    expect(remainingValues).toHaveLength(0);
  });

  it("sets, reads, and unsets a task's custom field value", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const task = await createTaskFixture(
      project.id,
      columns.todo.id,
      member.user.id,
    );
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const fieldResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: member.workspace.id,
        name: "Story points",
        type: "number",
      }),
    });
    const field = (await fieldResponse.json()) as { id: string };

    const setResponse = await app.request(
      `/api/custom-field/task/${task.id}/${field.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "5" }),
      },
    );
    expect(setResponse.status).toBe(200);

    const listResponse = await app.request(`/api/custom-field/task/${task.id}`);
    const values = (await listResponse.json()) as { value: string }[];
    expect(values).toHaveLength(1);
    expect(values[0]?.value).toBe("5");

    const unsetResponse = await app.request(
      `/api/custom-field/task/${task.id}/${field.id}`,
      { method: "DELETE" },
    );
    expect(unsetResponse.status).toBe(200);

    const afterUnset = await db.query.taskCustomFieldValueTable.findMany({
      where: eq(schema.taskCustomFieldValueTable.taskId, task.id),
    });
    expect(afterUnset).toHaveLength(0);
  });

  it("rejects an invalid value for the field's type", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await createTaskFixture(
      project.id,
      columns.todo.id,
      admin.user.id,
    );
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const fieldResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Story points",
        type: "number",
      }),
    });
    const field = (await fieldResponse.json()) as { id: string };

    const response = await app.request(
      `/api/custom-field/task/${task.id}/${field.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "not-a-number" }),
      },
    );
    expect(response.status).toBe(400);
  });

  it("rejects a select value that isn't one of the field's options", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await createTaskFixture(
      project.id,
      columns.todo.id,
      admin.user.id,
    );
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const fieldResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Client tier",
        type: "select",
        options: ["Gold", "Silver"],
      }),
    });
    const field = (await fieldResponse.json()) as { id: string };

    const response = await app.request(
      `/api/custom-field/task/${task.id}/${field.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "Platinum" }),
      },
    );
    expect(response.status).toBe(400);
  });

  it("rejects setting a value with a field from a different workspace", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const otherAdmin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await createTaskFixture(
      project.id,
      columns.todo.id,
      admin.user.id,
    );

    mockAuthenticatedSession(otherAdmin.user);
    const otherApp = createApp().app;
    const fieldResponse = await otherApp.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: otherAdmin.workspace.id,
        name: "Foreign field",
        type: "text",
      }),
    });
    const foreignField = (await fieldResponse.json()) as { id: string };

    // The task belongs to `admin`'s workspace and its own user can reach it,
    // but the field belongs to a different workspace entirely.
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/custom-field/task/${task.id}/${foreignField.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "x" }),
      },
    );
    // The route's access middleware resolves workspace from the *task*
    // (fromTaskId()), not the field -- admin genuinely owns that task, so
    // it passes. It's set-task-custom-field-value.ts's own explicit
    // cross-workspace check that catches the mismatched field and rejects.
    expect(response.status).toBe(400);
  });

  it("returns 404 unsetting a value that was never set", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await createTaskFixture(
      project.id,
      columns.todo.id,
      admin.user.id,
    );
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const fieldResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: admin.workspace.id,
        name: "Story points",
        type: "number",
      }),
    });
    const field = (await fieldResponse.json()) as { id: string };

    const response = await app.request(
      `/api/custom-field/task/${task.id}/${field.id}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(404);
  });
});
