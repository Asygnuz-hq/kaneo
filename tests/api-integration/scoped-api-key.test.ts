import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: scoped API keys", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates a key that can never do more than the creator's own workspace role, and can narrow it further", async () => {
    // Owner: the workspace role alone would allow both create and delete.
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const createKeyResponse = await app.request("/api/user/api-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Scoped integration key",
        expiresIn: null,
        permissions: { task: ["create"] },
      }),
    });
    expect(createKeyResponse.status).toBe(200);
    const created = (await createKeyResponse.json()) as { key: string };
    expect(created.key).toBeTruthy();

    // Within scope: creating a task only needs task:create, which the key grants.
    const createTaskResponse = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": created.key,
      },
      body: JSON.stringify({
        title: "Created via scoped key",
        description: "",
        status: "to-do",
        priority: "medium",
      }),
    });
    expect(createTaskResponse.status).toBe(200);
    const task = (await createTaskResponse.json()) as { id: string };

    // Outside scope: deleting needs task:delete. The owner role allows it,
    // but the key was never granted it, so the key must still be refused.
    const deleteTaskResponse = await app.request(`/api/task/${task.id}`, {
      method: "DELETE",
      headers: { "x-api-key": created.key },
    });
    expect(deleteTaskResponse.status).toBe(403);
    const deleteError = await deleteTaskResponse.text();
    expect(deleteError).toContain("Insufficient API key scope");
  });

  it("omitting permissions creates a key limited only by the creator's own workspace role", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const createKeyResponse = await app.request("/api/user/api-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Unscoped integration key",
        expiresIn: null,
      }),
    });
    expect(createKeyResponse.status).toBe(200);
    const created = (await createKeyResponse.json()) as { key: string };

    // "member" is allowed to create tasks -- no explicit permissions were
    // requested, so the key should fall back to that role, not be refused.
    const createTaskResponse = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": created.key,
      },
      body: JSON.stringify({
        title: "Created via unscoped key",
        description: "",
        status: "to-do",
        priority: "medium",
      }),
    });
    expect(createTaskResponse.status).toBe(200);
  });
});
