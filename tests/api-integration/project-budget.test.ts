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
  columnId: string | null,
  number = 1,
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Billable work",
      description: "",
      priority: "low",
      status: "to-do",
      columnId,
      number,
      position: number,
    })
    .returning();
  return task;
}

async function setRate(
  app: ReturnType<typeof createApp>["app"],
  workspaceId: string,
  userId: string,
  hourlyRateCents: number | null,
) {
  return app.request(`/api/workspace/${workspaceId}/members/${userId}/rate`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hourlyRateCents }),
  });
}

async function logTime(
  app: ReturnType<typeof createApp>["app"],
  taskId: string,
  hours: number,
  billable = true,
) {
  const startTime = new Date("2026-01-01T09:00:00.000Z");
  const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
  return app.request("/api/time-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      billable,
    }),
  });
}

async function addPlainMember(workspaceId: string) {
  const memberUserId = `user-member-${crypto.randomUUID()}`;
  await db.insert(schema.userTable).values({
    id: memberUserId,
    email: `${memberUserId}@example.com`,
    emailVerified: true,
    name: "Plain Member",
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: memberUserId,
    role: "member",
    joinedAt: new Date(),
  });
  return { id: memberUserId };
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("workspace member hourly rate", () => {
  it("lets an owner set another member's rate", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await setRate(
      app,
      owner.workspace.id,
      owner.user.id,
      15000,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ hourlyRateCents: 15000 });
  });

  it("rejects a plain member setting a rate (needs workspace:manage_settings)", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const member = await addPlainMember(owner.workspace.id);

    mockAuthenticatedSession({ id: member.id } as typeof owner.user);
    const { app } = createApp();

    const response = await setRate(
      app,
      owner.workspace.id,
      owner.user.id,
      15000,
    );

    expect(response.status).toBe(403);
  });

  it("redacts other members' hourly rate for a plain member listing the team", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const member = await addPlainMember(owner.workspace.id);

    mockAuthenticatedSession(owner.user);
    const { app: ownerApp } = createApp();
    await setRate(ownerApp, owner.workspace.id, owner.user.id, 15000);

    mockAuthenticatedSession({ id: member.id } as typeof owner.user);
    const { app: memberApp } = createApp();
    const asMember = await memberApp.request(
      `/api/workspace/${owner.workspace.id}/members`,
    );
    const memberView = await asMember.json();
    expect(
      memberView.every(
        (m: { hourlyRateCents: unknown }) => m.hourlyRateCents === null,
      ),
    ).toBe(true);

    mockAuthenticatedSession(owner.user);
    const { app: ownerApp2 } = createApp();
    const asOwner = await ownerApp2.request(
      `/api/workspace/${owner.workspace.id}/members`,
    );
    const ownerView = await asOwner.json();
    expect(
      ownerView.some(
        (m: { id: string; hourlyRateCents: unknown }) =>
          m.id === owner.user.id && m.hourlyRateCents === 15000,
      ),
    ).toBe(true);
  });
});

describe("time entry billing snapshot", () => {
  it("snapshots the logger's current workspace rate onto the entry", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, 10000);

    const response = await logTime(app, task.id, 2);
    expect(response.status).toBe(200);
    const entry = await response.json();
    expect(entry.hourlyRateCentsSnapshot).toBe(10000);
    expect(entry.billable).toBe(true);
  });

  it("leaves the snapshot null when no rate has been set yet", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await logTime(app, task.id, 1);
    const entry = await response.json();
    expect(entry.hourlyRateCentsSnapshot).toBeNull();
  });

  it("does not retroactively change an already-logged entry's rate", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, 10000);
    const first = await (await logTime(app, task.id, 1)).json();

    await setRate(app, owner.workspace.id, owner.user.id, 20000);
    const second = await (await logTime(app, task.id, 1)).json();

    expect(first.hourlyRateCentsSnapshot).toBe(10000);
    expect(second.hourlyRateCentsSnapshot).toBe(20000);
  });
});

describe("project budget", () => {
  it("sets and clears a project's contracted budget", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const setResponse = await app.request(`/api/project/${project.id}/budget`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetCents: 500000000, currency: "COP" }),
    });
    expect(setResponse.status).toBe(200);
    const set = await setResponse.json();
    expect(set).toMatchObject({ budgetCents: 500000000, currency: "COP" });

    const clearResponse = await app.request(
      `/api/project/${project.id}/budget`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetCents: null, currency: "COP" }),
      },
    );
    const cleared = await clearResponse.json();
    expect(cleared.budgetCents).toBeNull();
  });

  it("computes spend from billable time only, excludes unrated hours from cost, and projects a burn-rate total", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, 10000); // $100/hr

    // A task that will be marked done (counts toward completion).
    const doneTask = await seedTask(project.id, columns.done.id);
    // 3 billable hours @ $100/hr = $300 = 30000 cents.
    await logTime(app, doneTask.id, 3, true);
    // 2 non-billable hours — must not add to spend.
    await logTime(app, doneTask.id, 2, false);

    // A second, still-open task, so completion is 1/2 = 50%.
    const openTask = await seedTask(project.id, columns.todo.id, 2);
    // 1 billable hour with NO rate set for a different, unrated logger —
    // simulate by clearing the rate before logging on this task.
    await setRate(app, owner.workspace.id, owner.user.id, null);
    await logTime(app, openTask.id, 1, true);

    await app.request(`/api/project/${project.id}/budget`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetCents: 100000, currency: "USD" }),
    });

    const response = await app.request(
      `/api/project-metrics/${project.id}/budget`,
    );
    expect(response.status).toBe(200);
    const budget = await response.json();

    expect(budget.budgetCents).toBe(100000);
    expect(budget.spentCents).toBe(30000);
    expect(budget.billableSeconds).toBe((3 + 1) * 3600);
    expect(budget.nonBillableSeconds).toBe(2 * 3600);
    expect(budget.unratedBillableSeconds).toBe(1 * 3600);
    // 50% complete, spent 30000 -> projected total 60000.
    expect(budget.projectedTotalCents).toBe(60000);
  });

  it("returns a null projection when nothing is complete yet", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, 10000);
    const task = await seedTask(project.id, columns.todo.id);
    await logTime(app, task.id, 1, true);

    const response = await app.request(
      `/api/project-metrics/${project.id}/budget`,
    );
    const budget = await response.json();

    expect(budget.spentCents).toBe(10000);
    expect(budget.projectedTotalCents).toBeNull();
  });

  it("rejects a plain member viewing the project budget (needs workspace:manage_settings)", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const member = await addPlainMember(owner.workspace.id);

    mockAuthenticatedSession(owner.user);
    const { app: ownerApp } = createApp();
    await ownerApp.request(`/api/project/${project.id}/budget`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetCents: 100000, currency: "USD" }),
    });

    mockAuthenticatedSession({ id: member.id } as typeof owner.user);
    const { app: memberApp } = createApp();
    const response = await memberApp.request(
      `/api/project-metrics/${project.id}/budget`,
    );

    expect(response.status).toBe(403);
  });
});
