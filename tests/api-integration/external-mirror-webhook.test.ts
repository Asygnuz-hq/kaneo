import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const s3 = vi.hoisted(() => ({
  store: new Map<string, { body: Buffer; contentType: string }>(),
}));

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../apps/api/src/storage/s3")>();
  return {
    ...actual,
    putObjectAtKey: vi.fn(
      async (key: string, body: Buffer, contentType: string) => {
        s3.store.set(key, { body, contentType });
      },
    ),
    getPrivateObject: vi.fn(async (key: string) => {
      const found = s3.store.get(key);
      if (!found) throw new Error("missing object");
      return {
        body: new Blob([new Uint8Array(found.body)]).stream(),
        contentType: found.contentType,
      };
    }),
  };
});

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
    assignee?: { name: string | null; email?: string | null } | null;
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
      assignee: overrides?.assignee ?? null,
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
    expect(localTask?.description).toContain("Nueva descripción");
    expect(localTask?.description).toContain("Reflejado desde Kaneo Mia");
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

  it("mirrors a comment onto the mirrored task, attributed to kaneo-mia", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(app, taskEvent("task.created", { id: "ext-task-comment" }));
    const mirror = await findMirroredTask("ext-task-comment");

    const response = await postEvent(
      app,
      taskEvent("task.comment_created", {
        id: "ext-task-comment",
        data: { comment: "**Andrés Agudelo** commented:\n> Ya casi queda" },
      }),
    );
    expect(response.status).toBe(200);

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, mirror?.localTaskId ?? ""));
    const comment = activities.find((a) => a.type === "comment");
    expect(comment?.content).toBe(
      "**Andrés Agudelo** commented:\n> Ya casi queda",
    );
    expect(comment?.userId).toBeNull();
    expect(comment?.externalUserName).toBe("Kaneo Mia");
  });

  it("attaches the kaneo-mia assignee as an external assignee on creation", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(
      app,
      taskEvent("task.created", {
        id: "ext-task-assignee",
        assignee: {
          name: "Jorge Agudelo",
          email: "jorge@financieramentecu.com",
        },
      }),
    );

    const mirror = await findMirroredTask("ext-task-assignee");
    const assignees = await db
      .select({ name: schema.externalContactTable.name })
      .from(schema.taskExternalAssigneeTable)
      .innerJoin(
        schema.externalContactTable,
        eq(
          schema.externalContactTable.id,
          schema.taskExternalAssigneeTable.externalContactId,
        ),
      )
      .where(
        eq(schema.taskExternalAssigneeTable.taskId, mirror?.localTaskId ?? ""),
      );
    expect(assignees.map((a) => a.name)).toEqual(["Jorge Agudelo"]);
  });

  it("reuses the same external contact across mirrored tasks instead of duplicating it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(
      app,
      taskEvent("task.created", {
        id: "ext-task-assignee-a",
        assignee: { name: "Jorge Agudelo" },
      }),
    );
    await postEvent(
      app,
      taskEvent("task.created", {
        id: "ext-task-assignee-b",
        assignee: { name: "Jorge Agudelo" },
      }),
    );

    const contacts = await db
      .select()
      .from(schema.externalContactTable)
      .where(eq(schema.externalContactTable.workspaceId, owner.workspace.id));
    expect(contacts).toHaveLength(1);
  });

  it("updates the external assignee on task.assignee_changed", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;

    const { app } = createApp();
    await postEvent(
      app,
      taskEvent("task.created", { id: "ext-task-reassign" }),
    );
    const response = await postEvent(
      app,
      taskEvent("task.assignee_changed", {
        id: "ext-task-reassign",
        assignee: { name: "Andrés Agudelo" },
      }),
    );
    expect(response.status).toBe(200);

    const mirror = await findMirroredTask("ext-task-reassign");
    const assignees = await db
      .select({ name: schema.externalContactTable.name })
      .from(schema.taskExternalAssigneeTable)
      .innerJoin(
        schema.externalContactTable,
        eq(
          schema.externalContactTable.id,
          schema.taskExternalAssigneeTable.externalContactId,
        ),
      )
      .where(
        eq(schema.taskExternalAssigneeTable.taskId, mirror?.localTaskId ?? ""),
      );
    expect(assignees.map((a) => a.name)).toContain("Andrés Agudelo");
  });

  describe("descriptions and files", () => {
    async function setup() {
      const owner = await createWorkspaceMember({ role: "owner" });
      const { project } = await createProjectFixture({
        workspaceId: owner.workspace.id,
      });
      process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID = project.id;
      process.env.FINANCIEREMENTE_BASE_URL = "http://kaneo-mia.test";
      process.env.KANEO_API_URL = "http://asygnuz.test/api";
      process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
      process.env.S3_ENDPOINT = "http://s3.test";
      process.env.S3_BUCKET = "test-bucket";
      s3.store.clear();
      return { project };
    }

    function stubSender(files: Record<string, string>) {
      const fetchMock = vi.fn(async (url: string) => {
        const id = String(url).split("/").pop() ?? "";
        const content = files[id];
        if (content === undefined) return new Response("no", { status: 404 });
        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "X-Kaneo-Filename": encodeURIComponent("informe final.pdf"),
          },
        });
      });
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
      return fetchMock;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      delete process.env.FINANCIEREMENTE_BASE_URL;
      delete process.env.KANEO_API_URL;
      delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
    });

    async function localTask(externalId: string) {
      const mirror = await findMirroredTask(externalId);
      const [task] = await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, mirror?.localTaskId ?? ""));
      return task;
    }

    it("copies the full description on create and localizes its file links", async () => {
      await setup();
      const fetchMock = stubSender({ abc123: "PDFBYTES" });
      const { app } = createApp();
      await postEvent(
        app,
        taskEvent("task.created", {
          id: "ext-desc",
          data: {
            description:
              "Ver [informe](http://kaneo-mia.test/api/asset/abc123) y de nuevo http://kaneo-mia.test/api/asset/abc123",
          },
        }),
      );

      const task = await localTask("ext-desc");
      const [asset] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.taskId, task?.id ?? ""));
      expect(asset?.filename).toBe("informe final.pdf");
      expect(asset?.kind).toBe("attachment");
      expect(s3.store.size).toBe(1);
      // the same file linked twice is fetched and stored once
      const assetCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/external-mirror/asset/"),
      );
      expect(assetCalls).toHaveLength(1);
      expect(task?.description).toContain(
        `http://asygnuz.test/api/asset/${asset?.id}`,
      );
      expect(task?.description).not.toContain("kaneo-mia.test/api/asset");
      expect(task?.description).toContain("Reflejado desde Kaneo Mia");
    });

    it("keeps the original link when the file can't be fetched", async () => {
      await setup();
      stubSender({});
      const { app } = createApp();
      const response = await postEvent(
        app,
        taskEvent("task.created", {
          id: "ext-broken",
          data: {
            description: "[x](http://kaneo-mia.test/api/asset/gone999)",
          },
        }),
      );
      expect(response.status).toBe(200);
      const task = await localTask("ext-broken");
      expect(task?.description).toContain("kaneo-mia.test/api/asset/gone999");
    });

    it("rewrites file links inside a mirrored comment", async () => {
      await setup();
      stubSender({ zzz1: "IMG" });
      const { app } = createApp();
      await postEvent(app, taskEvent("task.created", { id: "ext-c" }));
      await postEvent(
        app,
        taskEvent("task.comment_created", {
          id: "ext-c",
          data: {
            comment:
              "**Ana** commented:\n> mira [foto](http://kaneo-mia.test/api/asset/zzz1)",
          },
        }),
      );
      const task = await localTask("ext-c");
      const activities = await db
        .select()
        .from(schema.activityTable)
        .where(eq(schema.activityTable.taskId, task?.id ?? ""));
      const comment = activities.find((a) => a.type === "comment");
      expect(comment?.content).toContain("http://asygnuz.test/api/asset/");
      expect(comment?.content).not.toContain("kaneo-mia.test");
      const [asset] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.taskId, task?.id ?? ""));
      expect(asset?.activityId).toBe(comment?.id);
    });

    it("appends a file to the description on task.attachment_added, once", async () => {
      await setup();
      stubSender({ att77: "DATA" });
      const { app } = createApp();
      await postEvent(app, taskEvent("task.created", { id: "ext-att" }));
      for (let i = 0; i < 2; i++) {
        await postEvent(
          app,
          taskEvent("task.attachment_added", {
            id: "ext-att",
            data: { asset: { id: "att77", filename: "informe final.pdf" } },
          }),
        );
      }
      const task = await localTask("ext-att");
      const links = task?.description?.match(/asygnuz\.test\/api\/asset\//g);
      expect(links).toHaveLength(1);
      const assets = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.taskId, task?.id ?? ""));
      expect(assets).toHaveLength(1);
    });

    it("serves an asset to a correctly signed request and refuses others", async () => {
      const { project } = await setup();
      const { app } = createApp();
      await postEvent(app, taskEvent("task.created", { id: "ext-serve" }));
      const task = await localTask("ext-serve");
      const key = `t/${project.id}/${task?.id}/file.pdf`;
      s3.store.set(key, {
        body: Buffer.from("HELLO"),
        contentType: "application/pdf",
      });
      const [asset] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: project.workspaceId,
          projectId: project.id,
          taskId: task?.id ?? "",
          objectKey: key,
          filename: "ñandú.pdf",
          mimeType: "application/pdf",
          size: 5,
          kind: "attachment",
          surface: "description",
        })
        .returning();
      const id = asset?.id ?? "";
      const sig = createHmac("sha256", SECRET).update(id).digest("hex");

      const ok = await app.request(`/api/external-mirror/asset/${id}`, {
        headers: { "X-Kaneo-Signature": sig },
      });
      expect(ok.status).toBe(200);
      expect(await ok.text()).toBe("HELLO");
      expect(decodeURIComponent(ok.headers.get("x-kaneo-filename") ?? "")).toBe(
        "ñandú.pdf",
      );

      const bad = await app.request(`/api/external-mirror/asset/${id}`, {
        headers: { "X-Kaneo-Signature": "00".repeat(32) },
      });
      expect(bad.status).toBe(400);
      const none = await app.request(`/api/external-mirror/asset/${id}`);
      expect(none.status).toBe(400);
      const missing = await app.request("/api/external-mirror/asset/nope", {
        headers: {
          "X-Kaneo-Signature": createHmac("sha256", SECRET)
            .update("nope")
            .digest("hex"),
        },
      });
      expect(missing.status).toBe(404);
    });
  });
});
