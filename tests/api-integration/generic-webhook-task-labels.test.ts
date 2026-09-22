import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import createLabel from "../../apps/api/src/label/controllers/create-label";
import { handleTaskCreated } from "../../apps/api/src/plugins/generic-webhook/events";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// The reverse mirror (kaneo-mia) decides which of its own projects a
// freshly-created Asygnuz task belongs to purely from its labels, so the
// outgoing task.created envelope must actually carry them.
describe("generic webhook: outgoing task.created carries labels", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  });

  it("includes the task's label names in the payload sent out", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Nueva tarea con etiqueta",
        description: "",
        priority: "low",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();
    if (!task) throw new Error("failed to seed task");

    await createLabel(
      "Tecnología",
      "yellow",
      task.id,
      owner.workspace.id,
      owner.user.id,
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await handleTaskCreated(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        number: task.number ?? 1,
      },
      {
        integrationId: "test-integration",
        projectId: project.id,
        config: {
          webhookUrl: "http://kaneo-mia.test/webhook",
          events: { taskCreated: true },
        },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(body.task.labels).toEqual(["Tecnología"]);
  });

  it("sends an empty labels array for an unlabeled task", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Sin etiqueta",
        description: "",
        priority: "low",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();
    if (!task) throw new Error("failed to seed task");

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await handleTaskCreated(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        number: task.number ?? 1,
      },
      {
        integrationId: "test-integration",
        projectId: project.id,
        config: {
          webhookUrl: "http://kaneo-mia.test/webhook",
          events: { taskCreated: true },
        },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(body.task.labels).toEqual([]);
  });
});
