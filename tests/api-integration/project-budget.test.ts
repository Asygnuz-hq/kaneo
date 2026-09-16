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
  rates: { hourlyRateCents?: number | null; billRateCents?: number | null },
) {
  return app.request(`/api/workspace/${workspaceId}/members/${userId}/rate`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rates),
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

describe("workspace member cost/bill rate", () => {
  it("lets an owner set another member's cost and bill rate independently", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 15000,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      hourlyRateCents: 10000,
      billRateCents: 15000,
    });
  });

  it("leaves the omitted rate unchanged when only one is passed", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 15000,
    });
    const response = await setRate(app, owner.workspace.id, owner.user.id, {
      billRateCents: 20000,
    });

    const body = await response.json();
    expect(body).toMatchObject({
      hourlyRateCents: 10000,
      billRateCents: 20000,
    });
  });

  it("rejects a plain member setting a rate (needs workspace:manage_settings)", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const member = await addPlainMember(owner.workspace.id);

    mockAuthenticatedSession({ id: member.id } as typeof owner.user);
    const { app } = createApp();

    const response = await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 15000,
    });

    expect(response.status).toBe(403);
  });

  it("redacts other members' rates for a plain member listing the team", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const member = await addPlainMember(owner.workspace.id);

    mockAuthenticatedSession(owner.user);
    const { app: ownerApp } = createApp();
    await setRate(ownerApp, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 15000,
    });

    mockAuthenticatedSession({ id: member.id } as typeof owner.user);
    const { app: memberApp } = createApp();
    const asMember = await memberApp.request(
      `/api/workspace/${owner.workspace.id}/members`,
    );
    const memberView = await asMember.json();
    expect(
      memberView.every(
        (m: { hourlyRateCents: unknown; billRateCents: unknown }) =>
          m.hourlyRateCents === null && m.billRateCents === null,
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
        (m: { id: string; hourlyRateCents: unknown; billRateCents: unknown }) =>
          m.id === owner.user.id &&
          m.hourlyRateCents === 10000 &&
          m.billRateCents === 15000,
      ),
    ).toBe(true);
  });
});

describe("time entry billing snapshot", () => {
  it("snapshots both the logger's cost and bill rate onto the entry", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 20000,
    });

    const response = await logTime(app, task.id, 2);
    expect(response.status).toBe(200);
    const entry = await response.json();
    expect(entry.hourlyRateCentsSnapshot).toBe(10000);
    expect(entry.billRateCentsSnapshot).toBe(20000);
    expect(entry.billable).toBe(true);
  });

  it("leaves both snapshots null when no rate has been set yet", async () => {
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
    expect(entry.billRateCentsSnapshot).toBeNull();
  });

  it("does not retroactively change an already-logged entry's rates", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 20000,
    });
    const first = await (await logTime(app, task.id, 1)).json();

    await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 15000,
      billRateCents: 25000,
    });
    const second = await (await logTime(app, task.id, 1)).json();

    expect(first.hourlyRateCentsSnapshot).toBe(10000);
    expect(first.billRateCentsSnapshot).toBe(20000);
    expect(second.hourlyRateCentsSnapshot).toBe(15000);
    expect(second.billRateCentsSnapshot).toBe(25000);
  });

  it("redacts rate snapshots on task time entries for a plain member", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);
    const member = await addPlainMember(owner.workspace.id);

    mockAuthenticatedSession(owner.user);
    const { app: ownerApp } = createApp();
    await setRate(ownerApp, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 20000,
    });
    await logTime(ownerApp, task.id, 1);

    mockAuthenticatedSession({ id: member.id } as typeof owner.user);
    const { app: memberApp } = createApp();
    const response = await memberApp.request(`/api/time-entry/task/${task.id}`);
    const entries = await response.json();

    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.every(
        (e: {
          hourlyRateCentsSnapshot: unknown;
          billRateCentsSnapshot: unknown;
        }) =>
          e.hourlyRateCentsSnapshot === null &&
          e.billRateCentsSnapshot === null,
      ),
    ).toBe(true);
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

  it("computes cost and billed separately, excludes unrated hours from each, and projects a burn-rate total off billed", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    // $100/hr cost, $200/hr bill.
    await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 20000,
    });

    // A task that will be marked done (counts toward completion).
    const doneTask = await seedTask(project.id, columns.done.id);
    // 3 billable hours @ $100/hr cost, $200/hr bill.
    await logTime(app, doneTask.id, 3, true);
    // 2 non-billable hours — must not add to cost or billed.
    await logTime(app, doneTask.id, 2, false);

    // A second, still-open task, so completion is 1/2 = 50%.
    const openTask = await seedTask(project.id, columns.todo.id, 2);
    // 1 billable hour with NO rates set — simulate by clearing both first.
    await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: null,
      billRateCents: null,
    });
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
    expect(budget.costCents).toBe(30000);
    expect(budget.billedCents).toBe(60000);
    expect(budget.marginCents).toBe(30000);
    expect(budget.billableSeconds).toBe((3 + 1) * 3600);
    expect(budget.nonBillableSeconds).toBe(2 * 3600);
    expect(budget.unratedCostSeconds).toBe(1 * 3600);
    expect(budget.unratedBillSeconds).toBe(1 * 3600);
    // 50% complete, billed 60000 -> projected total 120000.
    expect(budget.projectedBilledCents).toBe(120000);
  });

  it("returns a null projection when nothing is complete yet", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await setRate(app, owner.workspace.id, owner.user.id, {
      hourlyRateCents: 10000,
      billRateCents: 20000,
    });
    const task = await seedTask(project.id, columns.todo.id);
    await logTime(app, task.id, 1, true);

    const response = await app.request(
      `/api/project-metrics/${project.id}/budget`,
    );
    const budget = await response.json();

    expect(budget.costCents).toBe(10000);
    expect(budget.billedCents).toBe(20000);
    expect(budget.projectedBilledCents).toBeNull();
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
