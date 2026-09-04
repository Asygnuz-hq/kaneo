import { randomUUID } from "node:crypto";
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

describe("API integration: task templates", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated template creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "missing", name: "Bug report" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects template creation for a member without project:update", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, name: "Bug report" }),
    });

    expect(response.status).toBe(403);
  });

  it("creates a template with defaults for a workspace admin", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Bug report",
        title: "Bug: ",
        description: "Steps to reproduce:",
        priority: "high",
        issueType: "bug",
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      projectId: project.id,
      name: "Bug report",
      title: "Bug: ",
      description: "Steps to reproduce:",
      priority: "high",
      issueType: "bug",
      labelIds: [],
      position: 0,
    });
  });

  it("rejects a duplicate template name in the same project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    await db.insert(schema.taskTemplateTable).values({
      projectId: project.id,
      name: "Bug report",
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, name: "Bug report" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid priority", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Weird",
        priority: "not-a-priority",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid issue type", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Weird",
        issueType: "not-a-type",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a labelId that doesn't belong to the project's workspace", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Weird",
        labelIds: ["label-does-not-exist"],
      }),
    });

    expect(response.status).toBe(400);
  });

  it("creates a template with valid workspace labels attached", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ff0000",
        workspaceId: admin.workspace.id,
      })
      .returning();
    if (!label) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Bug report",
        labelIds: [label.id],
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.labelIds).toEqual([label.id]);
  });

  it("orders templates by position and lists them for a project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    for (const name of ["First", "Second", "Third"]) {
      const response = await app.request("/api/task-template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, name }),
      });
      expect(response.status).toBe(200);
    }

    const listResponse = await app.request(
      `/api/task-template/project/${project.id}`,
    );
    expect(listResponse.status).toBe(200);
    const payload = (await listResponse.json()) as Array<{ name: string }>;
    expect(payload.map((t) => t.name)).toEqual(["First", "Second", "Third"]);
  });

  it("updates a template's fields", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [template] = await db
      .insert(schema.taskTemplateTable)
      .values({ projectId: project.id, name: "Original" })
      .returning();
    if (!template) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/task-template/${template.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed", priority: "urgent" }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ name: "Renamed", priority: "urgent" });
  });

  it("rejects renaming a template to a name already used in the project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    await db.insert(schema.taskTemplateTable).values({
      projectId: project.id,
      name: "Taken",
    });
    const [template] = await db
      .insert(schema.taskTemplateTable)
      .values({ projectId: project.id, name: "Original" })
      .returning();
    if (!template) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/task-template/${template.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Taken" }),
    });

    expect(response.status).toBe(400);
  });

  it("deletes a template and 400s deleting it again", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [template] = await db
      .insert(schema.taskTemplateTable)
      .values({ projectId: project.id, name: "To delete" })
      .returning();
    if (!template) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const first = await app.request(`/api/task-template/${template.id}`, {
      method: "DELETE",
    });
    expect(first.status).toBe(200);

    const second = await app.request(`/api/task-template/${template.id}`, {
      method: "DELETE",
    });
    expect(second.status).toBe(400);

    const remaining = await db.query.taskTemplateTable.findFirst({
      where: eq(schema.taskTemplateTable.id, template.id),
    });
    expect(remaining).toBeUndefined();
  });

  it("rejects duplicate labelIds", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Bug",
        color: "#ff0000",
        workspaceId: admin.workspace.id,
      })
      .returning();
    if (!label) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/task-template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: `Dup-${randomUUID()}`,
        labelIds: [label.id, label.id],
      }),
    });

    expect(response.status).toBe(400);
  });
});
