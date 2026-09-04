import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeAutomationEngine } from "../../apps/api/src/automation/engine";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// The event-bus subscriptions are process-global and idempotent (guarded by
// a module-level flag) -- safe to arm once for every test in this file
// rather than re-subscribing per test.
initializeAutomationEngine();

// publishEvent() (apps/api/src/events/index.ts) does NOT await its
// subscribers -- EventEmitter.emit() calls each listener synchronously but
// doesn't wait on the promise an async listener returns, so the engine's
// DB-writing action can still be in flight after the HTTP response that
// published the triggering event has already resolved. That's the right
// production behavior (moving a task shouldn't get slower for every
// automation rule attached to it), so the test polls for the effect
// instead of asserting immediately after the request.
async function waitFor<T>(
  read: () => Promise<T>,
  matches: (value: T) => boolean,
  { timeoutMs = 2000, intervalMs = 20 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  do {
    last = await read();
    if (matches(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return last;
}

async function seedTask({
  projectId,
  columnId,
  userId,
  status = "to-do",
  priority = "medium",
}: {
  projectId: string;
  columnId: string;
  userId: string;
  status?: string;
  priority?: string;
}) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      userId,
      title: "Automation target",
      description: "Seeded for automation-rule.test.ts",
      status,
      columnId,
      priority,
      number: 1,
      position: 1,
    })
    .returning();
  if (!task) throw new Error("Failed to seed task");
  return task;
}

describe("API integration: automation rules", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated automation rule creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/automation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "project-missing",
        name: "Rule",
        triggerType: "task.created",
        triggerConfig: {},
        actionType: "set_priority",
        actionConfig: { priority: "high" },
      }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects rule creation for a member without project:update", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/automation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Rule",
        triggerType: "task.created",
        triggerConfig: {},
        actionType: "set_priority",
        actionConfig: { priority: "high" },
      }),
    });

    expect(response.status).toBe(403);
  });

  it("creates a rule for a workspace admin", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/automation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Move to Done -> mark urgent",
        triggerType: "task.status_changed",
        triggerConfig: { toStatus: columns.done.slug },
        actionType: "set_priority",
        actionConfig: { priority: "urgent" },
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      projectId: project.id,
      name: "Move to Done -> mark urgent",
      isActive: true,
      triggerType: "task.status_changed",
      triggerConfig: { toStatus: columns.done.slug },
      actionType: "set_priority",
      actionConfig: { priority: "urgent" },
    });
  });

  it("rejects an unknown trigger type", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/automation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Bad trigger",
        triggerType: "task.exploded",
        triggerConfig: {},
        actionType: "set_priority",
        actionConfig: { priority: "high" },
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a move_to_column action pointing at a column from another project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const { columns: otherColumns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
      name: "Other project",
      slug: `other-${randomUUID()}`,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/automation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Cross-project column",
        triggerType: "task.created",
        triggerConfig: {},
        actionType: "move_to_column",
        actionConfig: { columnId: otherColumns.done.id },
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a trigger.toStatus that isn't a valid status for the project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/automation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Bad status filter",
        triggerType: "task.status_changed",
        triggerConfig: { toStatus: "not-a-real-status" },
        actionType: "set_priority",
        actionConfig: { priority: "high" },
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects an assign_user action targeting a non-member", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const outsiderId = `user-${randomUUID()}`;
    await db.insert(schema.userTable).values({
      id: outsiderId,
      email: `${outsiderId}@example.com`,
      emailVerified: true,
      name: "Outsider",
    });
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request("/api/automation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Assign outsider",
        triggerType: "task.created",
        triggerConfig: {},
        actionType: "assign_user",
        actionConfig: { userId: outsiderId },
      }),
    });

    expect(response.status).toBe(403);
  });

  it("lists rules for a project", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [rule] = await db
      .insert(schema.automationRuleTable)
      .values({
        projectId: project.id,
        name: "Existing rule",
        triggerType: "task.created",
        triggerConfig: "{}",
        actionType: "set_priority",
        actionConfig: JSON.stringify({ priority: "low" }),
      })
      .returning();
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/automation/project/${project.id}`);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ id: string }>;
    expect(payload).toHaveLength(1);
    expect(payload[0]?.id).toBe(rule?.id);
  });

  it("updates a rule's name and isActive", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [rule] = await db
      .insert(schema.automationRuleTable)
      .values({
        projectId: project.id,
        name: "Original name",
        triggerType: "task.created",
        triggerConfig: "{}",
        actionType: "set_priority",
        actionConfig: JSON.stringify({ priority: "low" }),
      })
      .returning();
    if (!rule) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/automation/${rule.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed", isActive: false }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ name: "Renamed", isActive: false });
  });

  it("rejects switching actionType without a compatible actionConfig", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [rule] = await db
      .insert(schema.automationRuleTable)
      .values({
        projectId: project.id,
        name: "Column mover",
        triggerType: "task.created",
        triggerConfig: "{}",
        actionType: "move_to_column",
        actionConfig: JSON.stringify({ columnId: "some-column" }),
      })
      .returning();
    if (!rule) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    // Old actionConfig ({columnId}) is left in place but the type switches
    // to set_priority, which doesn't recognize "columnId" -- must be
    // rejected rather than silently persisted.
    const response = await app.request(`/api/automation/${rule.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionType: "set_priority" }),
    });

    expect(response.status).toBe(400);
  });

  it("deletes a rule and 404s deleting it again", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const [rule] = await db
      .insert(schema.automationRuleTable)
      .values({
        projectId: project.id,
        name: "To delete",
        triggerType: "task.created",
        triggerConfig: "{}",
        actionType: "set_priority",
        actionConfig: JSON.stringify({ priority: "low" }),
      })
      .returning();
    if (!rule) throw new Error("seed failed");
    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const first = await app.request(`/api/automation/${rule.id}`, {
      method: "DELETE",
    });
    expect(first.status).toBe(200);

    const second = await app.request(`/api/automation/${rule.id}`, {
      method: "DELETE",
    });
    expect(second.status).toBe(400);
  });

  it("runs the action when the trigger's status filter matches", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      userId: admin.user.id,
      status: "to-do",
      priority: "medium",
    });
    await db.insert(schema.automationRuleTable).values({
      projectId: project.id,
      name: "Done -> urgent",
      triggerType: "task.status_changed",
      triggerConfig: JSON.stringify({ toStatus: columns.done.slug }),
      actionType: "set_priority",
      actionConfig: JSON.stringify({ priority: "urgent" }),
    });

    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: columns.done.slug }),
    });
    expect(response.status).toBe(200);

    const updated = await waitFor(
      () =>
        db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        }),
      (row) => row?.priority === "urgent",
    );
    expect(updated?.priority).toBe("urgent");
  });

  it("does not run the action when the trigger's status filter doesn't match", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      userId: admin.user.id,
      status: "to-do",
      priority: "medium",
    });
    await db.insert(schema.automationRuleTable).values({
      projectId: project.id,
      name: "Done -> urgent",
      triggerType: "task.status_changed",
      triggerConfig: JSON.stringify({ toStatus: columns.done.slug }),
      actionType: "set_priority",
      actionConfig: JSON.stringify({ priority: "urgent" }),
    });

    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: columns.inProgress.slug }),
    });
    expect(response.status).toBe(200);

    // Nothing should happen here, so there's no future state to poll for --
    // just give the (non-matching) subscriber a generous window to have run
    // if it were going to.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const updated = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(updated?.priority).toBe("medium");
  });

  it("does not run an inactive rule's action", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      userId: admin.user.id,
      status: "to-do",
      priority: "medium",
    });
    await db.insert(schema.automationRuleTable).values({
      projectId: project.id,
      name: "Disabled rule",
      isActive: false,
      triggerType: "task.status_changed",
      triggerConfig: JSON.stringify({ toStatus: columns.done.slug }),
      actionType: "set_priority",
      actionConfig: JSON.stringify({ priority: "urgent" }),
    });

    mockAuthenticatedSession(admin.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: columns.done.slug }),
    });
    expect(response.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 300));
    const updated = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(updated?.priority).toBe("medium");
  });
});
