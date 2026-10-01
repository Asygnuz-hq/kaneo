import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Email only for "a task showed up that is now yours" -- every other
 * notification type still shows up in-app (the bell), it just stops
 * reaching a mailbox. Before this, every type that had email turned on in
 * the user's preferences sent one.
 */

const sendNotificationEmail = vi.fn(async () => ({ id: "email-1" }));

vi.mock("@kaneo/email", () => ({
  isSmtpConfigured: () => true,
  sendNotificationEmail: (...args: unknown[]) => sendNotificationEmail(...args),
}));

const { default: db, schema } = await import("../../apps/api/src/database");
const createNotification = (
  await import(
    "../../apps/api/src/notification/controllers/create-notification"
  )
).default;
const { resetTestDatabase } = await import("./helpers/database");
const { createProjectFixture, createWorkspaceMember } = await import(
  "./helpers/fixtures"
);

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

describe("notification email: restricted to task_created", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sendNotificationEmail.mockClear();
  });

  async function seedTask() {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Tarea de prueba",
        description: "",
        priority: "low",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();
    if (!task) throw new Error("seed failed");

    // delivery bails out before even looking at the notification's type
    // unless the account has both of these -- the global channel switch
    // (off by default until someone visits settings at all) and a
    // workspace rule turning email on for it (off by default too). An
    // account set up this fully opted-in is what should still only ever
    // get email for a task being created.
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: owner.user.id,
      emailEnabled: true,
    });
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId: owner.user.id,
      workspaceId: owner.workspace.id,
      isActive: true,
      emailEnabled: true,
      projectMode: "all",
    });

    return { owner, task };
  }

  it("sends email for task_created", async () => {
    const { owner, task } = await seedTask();
    await createNotification({
      userId: owner.user.id,
      type: "task_created",
      eventData: { taskTitle: task.title },
      resourceId: task.id,
      resourceType: "task",
    });
    await settle();
    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it.each([
    "task_status_changed",
    "task_assignee_changed",
    "task_comment",
    "task_mention",
    "due_date_reminder",
    "task_overdue",
    "time_entry_created",
    "workspace_created",
  ])("does not send email for %s", async (type) => {
    const { owner, task } = await seedTask();
    await createNotification({
      userId: owner.user.id,
      type,
      eventData: { taskTitle: task.title },
      resourceId: task.id,
      resourceType: "task",
    });
    await settle();
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });
});
