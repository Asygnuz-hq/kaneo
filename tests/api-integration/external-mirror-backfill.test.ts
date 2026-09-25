import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const SECRET = "test-backfill-secret";

const sign = (body: string) =>
  createHmac("sha256", SECRET).update(body).digest("hex");

describe("external mirror: backfill", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.FINANCIEREMENTE_MIRROR_SECRET = SECRET;
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FINANCIEREMENTE_MIRROR_SECRET;
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  });

  it("refuses a request without a valid signature", async () => {
    const { app } = createApp();
    const response = await app.request("/api/external-mirror/backfill", {
      method: "POST",
      headers: { "X-Kaneo-Signature": "00".repeat(32) },
      body: "{}",
    });
    expect(response.status).toBe(400);
  });

  it("re-sends every task as task.created, parents first", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const seed = async (title: string, number: number) => {
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title,
          description: `desc ${title}`,
          priority: "low",
          status: "to-do",
          columnId: columns.todo.id,
          number,
          position: number,
        })
        .returning();
      if (!task) throw new Error("seed failed");
      return task;
    };
    const child = await seed("Hija", 1);
    const parent = await seed("Madre", 2);
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
    await db.insert(schema.integrationTable).values({
      projectId: project.id,
      type: "generic-webhook",
      isActive: true,
      config: JSON.stringify({
        webhookUrl: "http://other-side.test/hook",
        events: { taskCreated: true },
      }),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { app } = createApp();
    const response = await app.request("/api/external-mirror/backfill", {
      method: "POST",
      headers: { "X-Kaneo-Signature": sign("{}") },
      body: "{}",
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ started: true, projects: 1 });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), {
      timeout: 5000,
    });
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse((call as unknown as [string, { body: string }])[1].body),
    );
    expect(bodies.map((b) => b.event)).toEqual([
      "task.created",
      "task.created",
    ]);
    expect(bodies.map((b) => b.task.title)).toEqual(["Madre", "Hija"]);
    expect(bodies[1].task.parent.id).toBe(parent.id);
    expect(bodies[0].data.description).toBe("desc Madre");
  });
});
