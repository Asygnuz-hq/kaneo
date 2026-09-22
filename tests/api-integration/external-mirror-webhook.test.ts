import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const SECRET = "test-mirror-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

async function postEvent(
  app: ReturnType<typeof createApp>["app"],
  event: unknown,
) {
  const body = JSON.stringify(event);
  return app.request("/api/external-mirror/financieramente", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kaneo-Signature": sign(body),
    },
    body,
  });
}

function taskEvent(
  event: string,
  overrides?: {
    id?: string;
    title?: string;
    status?: string;
    priority?: string;
    projectName?: string;
    data?: Record<string, unknown>;
  },
) {
  return {
    event,
    timestamp: new Date().toISOString(),
    integration: { type: "generic-webhook" },
    project: {
      id: "ext-project",
      name: overrides?.projectName ?? "Tecnología",
      workspaceId: "ext-ws",
    },
    task: {
      id: overrides?.id ?? "ext-task-1",
      number: 42,
      title: overrides?.title ?? "Arreglar el bug del portal",
      status: overrides?.status ?? "to-do",
      statusName: "Recibida",
      priority: overrides?.priority ?? "medium",
      url: "https://to-do.financieramentecu.com/task/ext-task-1",
    },
    actor: { id: "ext-user-1", name: "Andrés Agudelo" },
    data: overrides?.data ?? {},
  };
}

async function findMirroredTask(externalTaskId: string) {
  const [row] = await db
    .select()
    .from(schema.externalTaskMirrorTable)
    .where(eq(schema.externalTaskMirrorTable.externalTaskId, externalTaskId));
  return row ?? null;
}

beforeEach(async () => {
  await resetTestDatabase();
  process.env.FINANCIEREMENTE_MIRROR_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.FINANCIEREMENTE_MIRROR_SECRET;
  delete process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID;
});

describe("external mirror webhook", () => {
  it("404s when the mirror is not configured (no target project set)", async () => {
    const { app } = createApp();
    const response = await postEvent(app, taskEvent("task.created"));
    expect(response.status).toBe(404);
  });

  it("rejects a request with a missing or wrong signature", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    const body = JSON.stringify(taskEvent("task.created"));
    const response = await app.request("/api/external-mirror/financieramente", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kaneo-Signature": "0".repeat(64),
      },
      body,
    });
    expect(response.status).toBe(400);
  });

  it("creates a local task on task.created and records the mirror mapping", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    const response = await postEvent(
      app,
      taskEvent("task.created", { id: "ext-task-created" }),
    );
    expect(response.status).toBe(200);

    const mirror = await findMirroredTask("ext-task-created");
    expect(mirror).not.toBeNull();

    const [localTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));
    expect(localTask?.title).toBe("Arreglar el bug del portal");
    expect(localTask?.projectId).toBe(project.id);
    expect(localTask?.columnId).toBe(columns.todo.id);
  });

  it("is idempotent: a repeated task.created does not create a second local task", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(app, taskEvent("task.created", { id: "ext-task-dup" }));
    await postEvent(app, taskEvent("task.created", { id: "ext-task-dup" }));

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    expect(tasks).toHaveLength(1);
  });

  it("moves the mirrored task's column on task.status_changed", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(app, taskEvent("task.created", { id: "ext-task-move" }));
    const response = await postEvent(
      app,
      taskEvent("task.status_changed", {
        id: "ext-task-move",
        status: "done",
      }),
    );
    expect(response.status).toBe(200);

    const mirror = await findMirroredTask("ext-task-move");
    const [localTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));
    expect(localTask?.status).toBe("done");
    expect(localTask?.columnId).toBe(columns.done.id);
    expect(localTask?.completedAt).not.toBeNull();
  });

  it("falls back to the planned virtual status for an unknown incoming status", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(
      app,
      taskEvent("task.created", {
        id: "ext-task-weird-status",
        status: "some-unknown-slug",
      }),
    );

    const mirror = await findMirroredTask("ext-task-weird-status");
    const [localTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));
    expect(localTask?.status).toBe("planned");
  });

  it("updates title, description, priority and due date on the mirrored task", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(app, taskEvent("task.created", { id: "ext-task-edit" }));

    await postEvent(
      app,
      taskEvent("task.title_changed", {
        id: "ext-task-edit",
        title: "Nuevo título",
      }),
    );
    await postEvent(
      app,
      taskEvent("task.description_changed", {
        id: "ext-task-edit",
        data: { oldDescription: "", newDescription: "Nueva descripción" },
      }),
    );
    await postEvent(
      app,
      taskEvent("task.priority_changed", {
        id: "ext-task-edit",
        priority: "urgent",
      }),
    );
    await postEvent(
      app,
      taskEvent("task.due_date_changed", {
        id: "ext-task-edit",
        data: { newDueDate: "2026-10-01T00:00:00.000Z" },
      }),
    );

    const mirror = await findMirroredTask("ext-task-edit");
    const [localTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));
    expect(localTask?.title).toBe("Nuevo título");
    expect(localTask?.description).toBe("Nueva descripción");
    expect(localTask?.priority).toBe("urgent");
    expect(localTask?.dueDate?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("deletes the local task and its mirror row on task.deleted", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(app, taskEvent("task.created", { id: "ext-task-del" }));
    const mirror = await findMirroredTask("ext-task-del");
    expect(mirror).not.toBeNull();

    const response = await postEvent(
      app,
      taskEvent("task.deleted", { id: "ext-task-del" }),
    );
    expect(response.status).toBe(200);

    const [localTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));
    expect(localTask).toBeUndefined();
    expect(await findMirroredTask("ext-task-del")).toBeNull();
  });

  it("ignores an event for a task it never mirrored", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    const response = await postEvent(
      app,
      taskEvent("task.title_changed", { id: "never-seen", title: "x" }),
    );
    expect(response.status).toBe(200);

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    expect(tasks).toHaveLength(0);
  });

  it("is a no-op (breaks the echo loop) when the incoming status already matches", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(app, taskEvent("task.created", { id: "ext-task-echo" }));
    const mirror = await findMirroredTask("ext-task-echo");

    const [before] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));

    const response = await postEvent(
      app,
      taskEvent("task.status_changed", {
        id: "ext-task-echo",
        status: "to-do",
      }),
    );
    expect(response.status).toBe(200);

    const [after] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
    expect(columns.todo.id).toBe(after?.columnId);
  });

  it("registers the reverse mapping with kaneo-mia right after creating a mirror", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;
    process.env.FINANCIEREMENTE_BASE_URL = "http://kaneo-mia.test";
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ registered: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { app } = createApp();
    await postEvent(
      app,
      taskEvent("task.created", { id: "ext-task-callback" }),
    );

    const mirror = await findMirroredTask("ext-task-callback");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(calledUrl).toBe(
      "http://kaneo-mia.test/api/external-mirror/register",
    );
    expect(JSON.parse(calledInit.body)).toEqual({
      externalTaskId: mirror?.localTaskId,
      localTaskId: "ext-task-callback",
    });
    expect(calledInit.headers["X-Kaneo-Signature"]).toBe(
      createHmac("sha256", SECRET).update(calledInit.body).digest("hex"),
    );

    vi.unstubAllGlobals();
    delete process.env.FINANCIEREMENTE_BASE_URL;
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  });

  it("does not fail the mirror event when the reverse-registration callback fails", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;
    process.env.FINANCIEREMENTE_BASE_URL = "http://kaneo-mia.test";
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new Error("connection refused"),
        ) as unknown as typeof fetch,
    );

    const { app } = createApp();
    const response = await postEvent(
      app,
      taskEvent("task.created", { id: "ext-task-callback-fails" }),
    );
    expect(response.status).toBe(200);
    expect(await findMirroredTask("ext-task-callback-fails")).not.toBeNull();

    vi.unstubAllGlobals();
    delete process.env.FINANCIEREMENTE_BASE_URL;
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  });

  it("labels a mirrored task with its origin project so multiple kaneo-mia projects stay distinguishable", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(
      app,
      taskEvent("task.created", {
        id: "ext-task-comisiones",
        projectName: "Comisiones",
      }),
    );
    await postEvent(
      app,
      taskEvent("task.created", {
        id: "ext-task-tecnologia",
        projectName: "Tecnología",
      }),
    );

    const comisiones = await findMirroredTask("ext-task-comisiones");
    const tecnologia = await findMirroredTask("ext-task-tecnologia");

    const comisionesLabels = await db
      .select()
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, comisiones?.localTaskId ?? ""));
    const tecnologiaLabels = await db
      .select()
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, tecnologia?.localTaskId ?? ""));

    expect(comisionesLabels.map((l) => l.name)).toEqual(["Comisiones"]);
    expect(tecnologiaLabels.map((l) => l.name)).toEqual(["Tecnología"]);
    // Same project name must always resolve to the same color, run after run.
    expect(comisionesLabels[0]?.color).not.toBe(tecnologiaLabels[0]?.color);
  });

  it("does not duplicate the origin label on a repeated task.created", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(
      app,
      taskEvent("task.created", { id: "ext-task-label-dup" }),
    );
    await postEvent(
      app,
      taskEvent("task.created", { id: "ext-task-label-dup" }),
    );

    const mirror = await findMirroredTask("ext-task-label-dup");
    const labels = await db
      .select()
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, mirror?.localTaskId ?? ""));
    expect(labels).toHaveLength(1);
  });
});
