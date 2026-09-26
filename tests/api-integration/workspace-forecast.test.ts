import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const DAY = 24 * 60 * 60 * 1000;
let counter = 0;

async function seed(
  projectId: string,
  columnId: string,
  status: string,
  overrides: {
    userId?: string | null;
    dueDate?: Date | null;
    completedAt?: Date | null;
  } = {},
) {
  counter += 1;
  await db.insert(schema.taskTable).values({
    projectId,
    title: `Task ${counter}`,
    description: "",
    priority: "low",
    status,
    columnId,
    number: counter,
    position: counter,
    userId: overrides.userId ?? null,
    dueDate: overrides.dueDate ?? null,
    completedAt: overrides.completedAt ?? null,
  });
}

beforeEach(async () => {
  counter = 0;
  await resetTestDatabase();
});

describe("workspace forecast", () => {
  it("weighs what is due against what each person actually closes", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const now = Date.now();
    const me = owner.user.id;

    // closed 8 tasks in the last 8 weeks -> 1 per week
    for (let i = 0; i < 8; i++) {
      await seed(project.id, columns.done.id, "done", {
        userId: me,
        completedAt: new Date(now - (i + 1) * 5 * DAY),
      });
    }
    // 4 due in the next month, 3 already overdue, 1 unassigned due soon
    for (let i = 0; i < 4; i++) {
      await seed(project.id, columns.todo.id, "to-do", {
        userId: me,
        dueDate: new Date(now + (i + 2) * 3 * DAY),
      });
    }
    for (let i = 0; i < 3; i++) {
      await seed(project.id, columns.todo.id, "to-do", {
        userId: me,
        dueDate: new Date(now - (i + 1) * DAY),
      });
    }
    await seed(project.id, columns.todo.id, "to-do", {
      dueDate: new Date(now + 5 * DAY),
    });
    // due in range but already closed: needs no capacity
    await seed(project.id, columns.done.id, "done", {
      userId: me,
      dueDate: new Date(now + 4 * DAY),
    });
    // due far beyond the window: not part of it
    await seed(project.id, columns.todo.id, "to-do", {
      userId: me,
      dueDate: new Date(now + 90 * DAY),
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/project-metrics/workspace/${owner.workspace.id}/forecast`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.windowDays).toBe(30);
    expect(body.people).toHaveLength(1);
    const person = body.people[0];
    expect(person.userId).toBe(me);
    expect(person.closedInHistory).toBe(8);
    expect(person.velocityPerWeek).toBe(1);
    expect(person.capacity).toBe(4.3);
    expect(person.upcoming).toBe(4);
    expect(person.overdue).toBe(3);
    expect(person.demand).toBe(7);
    expect(person.status).toBe("overloaded");
    expect(person.atRisk).toBe(3);
    expect(person.confidence).toBe("high");
    expect(body.unassigned).toEqual({ upcoming: 1, overdue: 0 });
    expect(body.team.demand).toBe(8);
  });

  it("says 'no-history' for someone with work coming and nothing closed recently", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    await seed(project.id, columns.todo.id, "to-do", {
      userId: owner.user.id,
      dueDate: new Date(Date.now() + 3 * DAY),
    });
    // closed long ago, outside the eight-week history
    await seed(project.id, columns.done.id, "done", {
      userId: owner.user.id,
      completedAt: new Date(Date.now() - 200 * DAY),
    });

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const body = await (
      await app.request(
        `/api/project-metrics/workspace/${owner.workspace.id}/forecast`,
      )
    ).json();
    expect(body.people[0].status).toBe("no-history");
    expect(body.people[0].utilization).toBeNull();
    expect(body.people[0].confidence).toBe("low");
  });

  it("honours a custom window and returns an empty forecast for an empty workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/project-metrics/workspace/${owner.workspace.id}/forecast?days=14`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.windowDays).toBe(14);
    expect(body.people).toEqual([]);
    expect(body.team.status).toBe("idle");
  });

  it("refuses someone outside the workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const stranger = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(stranger.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/project-metrics/workspace/${owner.workspace.id}/forecast`,
    );
    expect(response.status).toBe(403);
  });
});
