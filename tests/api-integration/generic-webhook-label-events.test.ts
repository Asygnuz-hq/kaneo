import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import assignLabelToTask from "../../apps/api/src/label/controllers/assign-label-to-task";
import createLabel from "../../apps/api/src/label/controllers/create-label";
import deleteLabel from "../../apps/api/src/label/controllers/delete-label";
import unassignLabelFromTask from "../../apps/api/src/label/controllers/unassign-label-from-task";
import { initializePlugins } from "../../apps/api/src/plugins";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// A label added after a task exists is the only thing that tells the other
// Kaneo which of its projects the task belongs to, so BOTH ways of putting a
// label on a task (creating a new one, picking an existing one) must reach
// the webhook.
describe("generic webhook: labeling a task emits task.labeled", () => {
  // The event -> plugin wiring is only set up at server start, so it has to
  // be done here or these tests would exercise nothing.
  beforeAll(() => {
    initializePlugins();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  });

  async function setup() {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Tarea",
        description: "Detalle",
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
        webhookUrl: "http://other-side.test/hook",
        events: { taskMoved: true },
      }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    createApp();
    return { owner, project, task, fetchMock };
  }

  function labeledBodies(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls
      .map((call) =>
        JSON.parse((call as unknown as [string, { body: string }])[1].body),
      )
      .filter((body) => body.event === "task.labeled");
  }

  it("when a brand-new label is created on the task", async () => {
    const { owner, task, fetchMock } = await setup();
    await createLabel(
      "Tecnología",
      "yellow",
      task.id,
      owner.workspace.id,
      owner.user.id,
    );
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    expect(labeledBodies(fetchMock)[0].data.label).toBe("Tecnología");
    expect(labeledBodies(fetchMock)[0].task.labels).toEqual(["Tecnología"]);
  });

  it("when an existing workspace label is picked for the task", async () => {
    const { owner, task, fetchMock } = await setup();
    const template = await createLabel(
      "Comisiones",
      "gray",
      undefined,
      owner.workspace.id,
      owner.user.id,
    );
    await assignLabelToTask(template.id, task.id, owner.user.id);
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    expect(labeledBodies(fetchMock)[0].data.label).toBe("Comisiones");
    expect(labeledBodies(fetchMock)[0].task.labels).toEqual(["Comisiones"]);
  });

  // Symmetric with the other direction: kaneo-mia moving a task between its
  // own projects fires one event with both project names attached. Here,
  // there is only one project, so "moving" it is unassigning the old origin
  // label and assigning the new one -- two separate actions, in either
  // order -- and BOTH removal paths (unassign keeps the label definition
  // around for reuse; delete removes it outright) must reach the webhook too,
  // or whichever of the two actions happens first would go unheard.
  it("when a label is unassigned from the task (kept for reuse elsewhere)", async () => {
    const { owner, task, fetchMock } = await setup();
    const attached = await createLabel(
      "Tecnología",
      "yellow",
      task.id,
      owner.workspace.id,
      owner.user.id,
    );
    // let the creation's own (unrelated) background send land first, or its
    // fetch call can arrive AFTER mockClear() and get mistaken for this one.
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    fetchMock.mockClear();

    await unassignLabelFromTask(attached.id, owner.user.id);
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    expect(labeledBodies(fetchMock)[0].data.label).toBe("Tecnología");
    // it's gone from the task by the time the envelope is built
    expect(labeledBodies(fetchMock)[0].task.labels).toEqual([]);
  });

  it("when a label is deleted outright", async () => {
    const { owner, task, fetchMock } = await setup();
    const attached = await createLabel(
      "Comisiones",
      "gray",
      task.id,
      owner.workspace.id,
      owner.user.id,
    );
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    fetchMock.mockClear();

    await deleteLabel(attached.id, owner.user.id);
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    expect(labeledBodies(fetchMock)[0].data.label).toBe("Comisiones");
    expect(labeledBodies(fetchMock)[0].task.labels).toEqual([]);
  });

  it("swapping origin labels ends with only the new one in the envelope, in either order", async () => {
    const { owner, task, fetchMock } = await setup();
    const oldLabel = await createLabel(
      "Tecnología",
      "yellow",
      task.id,
      owner.workspace.id,
      owner.user.id,
    );
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    fetchMock.mockClear();

    // add-then-remove: whichever finishes last carries the true final state
    await createLabel(
      "Comisiones",
      "gray",
      task.id,
      owner.workspace.id,
      owner.user.id,
    );
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(1));
    await unassignLabelFromTask(oldLabel.id, owner.user.id);
    await vi.waitFor(() => expect(labeledBodies(fetchMock)).toHaveLength(2));

    const last = labeledBodies(fetchMock).at(-1);
    expect(last.task.labels).toEqual(["Comisiones"]);
  });
});
