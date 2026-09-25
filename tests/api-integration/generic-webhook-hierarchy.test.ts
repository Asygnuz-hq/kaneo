import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { runAsMirror } from "../../apps/api/src/external-mirror/context";
import createLabel from "../../apps/api/src/label/controllers/create-label";
import {
  handleTaskCreated,
  handleTaskLabeled,
  handleTaskParentLinked,
} from "../../apps/api/src/plugins/generic-webhook/events";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const context = (projectId: string, events: Record<string, boolean>) => ({
  integrationId: "test-integration",
  projectId,
  config: { webhookUrl: "http://kaneo-mia.test/webhook", events },
});

async function seedTask(
  projectId: string,
  columnId: string,
  overrides: Partial<typeof schema.taskTable.$inferInsert> = {},
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Tarea",
      description: "",
      priority: "low",
      status: "to-do",
      columnId,
      number: Math.floor(Math.random() * 100000),
      position: 1,
      ...overrides,
    })
    .returning();
  if (!task) throw new Error("failed to seed task");
  return task;
}

// The other side rebuilds who is assigned, what kind of task it is and where
// it hangs in the tree purely from the outgoing envelope.
describe("generic webhook: assignee, type and parent in the envelope", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  });

  function stubFetch() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    return fetchMock;
  }

  function sentBody(fetchMock: ReturnType<typeof stubFetch>) {
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    return JSON.parse(init.body);
  }

  it("sends the assignee's name and email, the issue type, and the parent", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const epic = await seedTask(project.id, columns.todo.id, {
      title: "Épica",
      issueType: "epic",
    });
    const child = await seedTask(project.id, columns.todo.id, {
      title: "Hija",
      userId: owner.user.id,
    });
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: epic.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });

    const fetchMock = stubFetch();
    await handleTaskCreated(
      {
        taskId: child.id,
        projectId: project.id,
        userId: owner.user.id,
        title: child.title,
        description: "",
        priority: "low",
        status: "to-do",
        number: 1,
      },
      context(project.id, { taskCreated: true }),
    );

    const body = sentBody(fetchMock);
    expect(body.task.assignee).toEqual({
      name: owner.user.name,
      email: owner.user.email,
    });
    expect(body.task.type).toBe("task");
    expect(body.task.parent).toEqual({
      id: epic.id,
      title: "Épica",
      type: "epic",
    });
  });

  it("lets a subtask borrow its parent's labels so the other side can route it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const epic = await seedTask(project.id, columns.todo.id, {
      issueType: "epic",
    });
    await createLabel(
      "Comisiones",
      "green",
      epic.id,
      owner.workspace.id,
      owner.user.id,
    );
    const child = await seedTask(project.id, columns.todo.id);
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: epic.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });

    const fetchMock = stubFetch();
    await handleTaskCreated(
      {
        taskId: child.id,
        projectId: project.id,
        userId: owner.user.id,
        title: child.title,
        description: "",
        priority: "low",
        status: "to-do",
        number: 1,
      },
      context(project.id, { taskCreated: true }),
    );
    expect(sentBody(fetchMock).task.labels).toEqual(["Comisiones"]);
  });

  it("emits task.parent_changed for the child once a subtask link is made", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const parent = await seedTask(project.id, columns.todo.id, {
      title: "Padre",
    });
    const child = await seedTask(project.id, columns.todo.id, {
      title: "Hijo",
    });
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });

    const fetchMock = stubFetch();
    await handleTaskParentLinked(
      {
        taskId: child.id,
        projectId: project.id,
        userId: owner.user.id,
        parentTaskId: parent.id,
      },
      context(project.id, { taskMoved: true }),
    );

    const body = sentBody(fetchMock);
    expect(body.event).toBe("task.parent_changed");
    expect(body.task.id).toBe(child.id);
    expect(body.task.parent.id).toBe(parent.id);
  });

  it("sends nothing for work the mirror itself is applying", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    const fetchMock = stubFetch();
    await runAsMirror(() =>
      handleTaskCreated(
        {
          taskId: task.id,
          projectId: project.id,
          userId: owner.user.id,
          title: task.title,
          description: "",
          priority: "low",
          status: "to-do",
          number: 1,
        },
        context(project.id, { taskCreated: true }),
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emits task.labeled with the label and the description when a label is added", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id, {
      description: "Descripción completa",
    });
    await createLabel(
      "Comisiones",
      "gray",
      task.id,
      owner.workspace.id,
      owner.user.id,
    );

    const fetchMock = stubFetch();
    await handleTaskLabeled(
      {
        taskId: task.id,
        projectId: project.id,
        userId: owner.user.id,
        labelName: "Comisiones",
      },
      context(project.id, { taskMoved: true }),
    );

    const body = sentBody(fetchMock);
    expect(body.event).toBe("task.labeled");
    expect(body.data.label).toBe("Comisiones");
    expect(body.data.description).toBe("Descripción completa");
    expect(body.task.labels).toEqual(["Comisiones"]);
  });
});
