import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import {
  handleTaskCommentCreated,
  handleTaskTitleChanged,
  processWebhookRetries,
} from "../../apps/api/src/plugins/generic-webhook/events";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const WEBHOOK = "http://other-side.test/hook";

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Titulo actual",
      description: "",
      priority: "low",
      status: "to-do",
      columnId: columns.todo.id,
      number: 1,
      position: 1,
    })
    .returning();
  if (!task) throw new Error("seed failed");
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "generic-webhook",
    isActive: true,
    config: JSON.stringify({
      webhookUrl: WEBHOOK,
      events: { taskTitleChanged: true, taskCommentCreated: true },
    }),
  });
  return { owner, project, task };
}

const context = (projectId: string) => ({
  integrationId: "i",
  projectId,
  config: {
    webhookUrl: WEBHOOK,
    events: { taskTitleChanged: true, taskCommentCreated: true },
  },
});

function stubFetch(handler: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async () => handler());
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

async function retries() {
  return db.select().from(schema.genericWebhookRetryTable);
}

async function makeDue() {
  await db
    .update(schema.genericWebhookRetryTable)
    .set({ nextAttemptAt: new Date(Date.now() - 1000) });
}

describe("generic webhook: failed deliveries are retried", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  });

  it("queues a delivery that failed instead of dropping it", async () => {
    const { owner, project, task } = await setup();
    stubFetch(() => new Response("down", { status: 503 }));

    await handleTaskTitleChanged(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        oldTitle: "a",
        newTitle: "b",
      },
      context(project.id),
    );

    const queued = await retries();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.eventName).toBe("task.title_changed");
    expect(queued[0]?.taskId).toBe(task.id);
  });

  it("collapses repeated state events for the same task into one retry", async () => {
    const { owner, project, task } = await setup();
    stubFetch(() => new Response("down", { status: 503 }));

    for (const newTitle of ["b", "c", "d"]) {
      await handleTaskTitleChanged(
        {
          taskId: task.id,
          projectId: project.id,
          userId: owner.user.id,
          oldTitle: "a",
          newTitle,
        },
        context(project.id),
      );
    }
    expect(await retries()).toHaveLength(1);
  });

  it("keeps every comment: they are not collapsed", async () => {
    const { owner, project, task } = await setup();
    stubFetch(() => new Response("down", { status: 503 }));

    for (const comment of ["uno", "dos"]) {
      await handleTaskCommentCreated(
        {
          taskId: task.id,
          projectId: project.id,
          userId: owner.user.id,
          comment,
          content: comment,
        },
        context(project.id),
      );
    }
    expect(await retries()).toHaveLength(2);
  });

  it("resends with the task as it is now, then clears the queue", async () => {
    const { owner, project, task } = await setup();
    stubFetch(() => new Response("down", { status: 503 }));
    await handleTaskTitleChanged(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        oldTitle: "a",
        newTitle: "viejo",
      },
      context(project.id),
    );

    // the task changes again while the other side is down
    await db
      .update(schema.taskTable)
      .set({ title: "Titulo mas reciente" })
      .where(eq(schema.taskTable.id, task.id));

    const fetchMock = stubFetch(() => new Response("{}", { status: 200 }));
    await makeDue();
    await processWebhookRetries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(init.body).task.title).toBe("Titulo mas reciente");
    expect(await retries()).toHaveLength(0);
  });

  it("does not resend before the retry is due", async () => {
    const { owner, project, task } = await setup();
    stubFetch(() => new Response("down", { status: 503 }));
    await handleTaskTitleChanged(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        oldTitle: "a",
        newTitle: "b",
      },
      context(project.id),
    );

    const fetchMock = stubFetch(() => new Response("{}", { status: 200 }));
    await processWebhookRetries();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await retries()).toHaveLength(1);
  });

  it("backs off after another failure and finally gives up", async () => {
    const { owner, project, task } = await setup();
    stubFetch(() => new Response("down", { status: 503 }));
    await handleTaskTitleChanged(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        oldTitle: "a",
        newTitle: "b",
      },
      context(project.id),
    );

    await makeDue();
    await processWebhookRetries();
    const [after] = await retries();
    expect(after?.attempts).toBe(1);
    expect(after?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    for (let i = 0; i < 12; i++) {
      await makeDue();
      await processWebhookRetries();
    }
    expect(await retries()).toHaveLength(0);
  });

  it("drops the retry when the task no longer exists", async () => {
    const { owner, project, task } = await setup();
    stubFetch(() => new Response("down", { status: 503 }));
    await handleTaskTitleChanged(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        oldTitle: "a",
        newTitle: "b",
      },
      context(project.id),
    );
    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));

    const fetchMock = stubFetch(() => new Response("{}", { status: 200 }));
    await makeDue();
    await processWebhookRetries();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await retries()).toHaveLength(0);
  });
});
