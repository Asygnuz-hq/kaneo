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

describe("API integration: doc pages", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated page creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "project-missing", title: "Intro" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects page creation by a member without project:update", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Intro" }),
    });

    expect(response.status).toBe(403);
  });

  it("creates a root page as a workspace admin", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Getting started",
        content: "# Welcome",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      parentId: string | null;
      position: number;
      createdByUserId: string;
    };
    expect(payload.parentId).toBeNull();
    expect(payload.position).toBe(0);
    expect(payload.createdByUserId).toBe(admin.user.id);

    const persisted = await db.query.docPageTable.findFirst({
      where: eq(schema.docPageTable.id, payload.id),
    });
    expect(persisted).toMatchObject({
      projectId: project.id,
      title: "Getting started",
      content: "# Welcome",
    });
  });

  it("creates a nested page under a parent in the same project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const parentResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Section" }),
    });
    const parent = (await parentResponse.json()) as { id: string };

    const childResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        parentId: parent.id,
        title: "Subsection",
      }),
    });
    expect(childResponse.status).toBe(200);
    const child = (await childResponse.json()) as { parentId: string };
    expect(child.parentId).toBe(parent.id);
  });

  it("rejects a parent page from a different project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project: projectA } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const { project: projectB } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const parentResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: projectA.id, title: "In A" }),
    });
    const parent = (await parentResponse.json()) as { id: string };

    const response = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: projectB.id,
        parentId: parent.id,
        title: "In B",
      }),
    });
    expect(response.status).toBe(400);
  });

  it("lists a project's pages flat, ordered by position, without content", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    for (const title of ["First", "Second", "Third"]) {
      await app.request("/api/doc-page", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, title, content: "x" }),
      });
    }

    const response = await app.request(`/api/doc-page/project/${project.id}`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>[];
    expect(payload.map((p) => p.title)).toEqual(["First", "Second", "Third"]);
    expect(payload.every((p) => !("content" in p))).toBe(true);
  });

  it("gets a single page including its content", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const createResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Runbook",
        content: "Step one.",
      }),
    });
    const page = (await createResponse.json()) as { id: string };

    const response = await app.request(`/api/doc-page/${page.id}`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { content: string };
    expect(payload.content).toBe("Step one.");
  });

  it("returns 404 for an unknown page", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/doc-page/does-not-exist?workspaceId=${admin.workspace.id}`,
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 when a page id can't be resolved to any workspace", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/doc-page/does-not-exist");
    expect(response.status).toBe(400);
  });

  it("updates a page's title and content", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const createResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Draft" }),
    });
    const page = (await createResponse.json()) as { id: string };

    const response = await app.request(`/api/doc-page/${page.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Final", content: "Done." }),
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as {
      title: string;
      content: string;
      updatedByUserId: string;
    };
    expect(updated.title).toBe("Final");
    expect(updated.content).toBe("Done.");
    expect(updated.updatedByUserId).toBe(admin.user.id);
  });

  it("moves a page under another page in the same project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const pageAResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "A" }),
    });
    const pageA = (await pageAResponse.json()) as { id: string };
    const pageBResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "B" }),
    });
    const pageB = (await pageBResponse.json()) as { id: string };

    const response = await app.request(`/api/doc-page/${pageB.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: pageA.id }),
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as { parentId: string };
    expect(updated.parentId).toBe(pageA.id);
  });

  it("rejects nesting a page under itself", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const createResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Solo" }),
    });
    const page = (await createResponse.json()) as { id: string };

    const response = await app.request(`/api/doc-page/${page.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: page.id }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects nesting a page under one of its own descendants", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const rootResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Root" }),
    });
    const root = (await rootResponse.json()) as { id: string };

    const childResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        parentId: root.id,
        title: "Child",
      }),
    });
    const child = (await childResponse.json()) as { id: string };

    // Root cannot become a child of its own child -- that would make the
    // tree a cycle.
    const response = await app.request(`/api/doc-page/${root.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: child.id }),
    });
    expect(response.status).toBe(400);
  });

  it("deletes a page and promotes its children to the root", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const parentResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Parent" }),
    });
    const parent = (await parentResponse.json()) as { id: string };

    const childResponse = await app.request("/api/doc-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        parentId: parent.id,
        title: "Child",
      }),
    });
    const child = (await childResponse.json()) as { id: string };

    const deleteResponse = await app.request(`/api/doc-page/${parent.id}`, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(200);

    const survivingChild = await db.query.docPageTable.findFirst({
      where: eq(schema.docPageTable.id, child.id),
    });
    expect(survivingChild?.parentId).toBeNull();
  });

  it("returns 404 deleting an unknown page", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/doc-page/does-not-exist?workspaceId=${admin.workspace.id}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(404);
  });
});
