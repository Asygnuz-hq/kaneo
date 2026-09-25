import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  externalTaskMirrorTable,
  integrationTable,
  labelTable,
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
  workspaceTable,
} from "../../database/schema";
import { isApplyingMirror } from "../../external-mirror/context";
import type {
  PluginContext,
  TaskAssigneeChangedEvent,
  TaskCommentCreatedEvent,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskDescriptionChangedEvent,
  TaskDueDateChangedEvent,
  TaskLabeledEvent,
  TaskMovedEvent,
  TaskParentLinkedEvent,
  TaskPriorityChangedEvent,
  TaskStatusChangedEvent,
  TaskTitleChangedEvent,
  TaskUnassignedEvent,
} from "../types";
import { postToGenericWebhook } from "./client";
import type { GenericWebhookConfig, GenericWebhookEventKey } from "./config";
import { normalizeGenericWebhookConfig } from "./config";
import {
  claimDueRetries,
  enqueueRetry,
  finishRetry,
  rescheduleRetry,
} from "./outbox";

type GenericWebhookTaskData = {
  id: string;
  title: string;
  number: number | null;
  status: string | null;
  statusName: string | null;
  priority: string | null;
  projectId: string;
  projectName: string;
  workspaceId: string;
  taskUrl: string;
  labels: string[];
  issueType: string;
  assignee: { name: string | null; email: string | null } | null;
  parent: { id: string; title: string; type: string } | null;
  // The kaneo-mia task this one was mirrored from, when it was born there.
  mirroredFrom: string | null;
};

function isEnabled(
  config: GenericWebhookConfig,
  key: GenericWebhookEventKey,
): boolean {
  return config.events?.[key] ?? false;
}

async function getTaskData(
  taskId: string,
  projectId: string,
): Promise<GenericWebhookTaskData | null> {
  const [taskRow] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      priority: taskTable.priority,
      columnName: columnTable.name,
      projectId: projectTable.id,
      projectName: projectTable.name,
      workspaceId: workspaceTable.id,
      issueType: taskTable.issueType,
      assigneeName: userTable.name,
      assigneeEmail: userTable.email,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(
      columnTable,
      and(
        eq(taskTable.columnId, columnTable.id),
        eq(columnTable.projectId, projectTable.id),
      ),
    )
    .where(and(eq(taskTable.id, taskId), eq(projectTable.id, projectId)))
    .limit(1);

  if (!taskRow) {
    return null;
  }

  const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";

  const labels = await db
    .select({ name: labelTable.name })
    .from(labelTable)
    .where(eq(labelTable.taskId, taskId));

  // The tree is built from "subtask" relations (source = parent), so the
  // parent is whichever task points at this one.
  const [parentRow] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      type: taskTable.issueType,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    )
    .limit(1);

  // A subtask rarely carries the origin label itself; borrowing its parent's
  // is what lets the other side know which project it belongs to.
  const ownLabels = labels.map((label) => label.name);
  const effectiveLabels =
    ownLabels.length === 0 && parentRow
      ? (
          await db
            .select({ name: labelTable.name })
            .from(labelTable)
            .where(eq(labelTable.taskId, parentRow.id))
        ).map((label) => label.name)
      : ownLabels;

  const [origin] = await db
    .select({ externalTaskId: externalTaskMirrorTable.externalTaskId })
    .from(externalTaskMirrorTable)
    .where(eq(externalTaskMirrorTable.localTaskId, taskId))
    .limit(1);

  const { assigneeName, assigneeEmail, ...rest } = taskRow;
  return {
    ...rest,
    mirroredFrom: origin?.externalTaskId ?? null,
    assignee: assigneeName
      ? { name: assigneeName, email: assigneeEmail }
      : null,
    parent: parentRow ?? null,
    status: taskRow.status,
    statusName: taskRow.columnName ?? taskRow.status,
    taskUrl: `${clientUrl}/dashboard/workspace/${taskRow.workspaceId}/project/${taskRow.projectId}/task/${taskId}`,
    labels: effectiveLabels,
  };
}

async function getActor(userId: string | null): Promise<{
  id: string | null;
  name: string | null;
}> {
  if (!userId) {
    return {
      id: null,
      name: null,
    };
  }

  const [user] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  return {
    id: user?.id ?? userId,
    name: user?.name ?? null,
  };
}

async function persistWebhookHealth(
  projectId: string,
  update: (config: GenericWebhookConfig) => GenericWebhookConfig,
): Promise<void> {
  try {
    const integration = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "generic-webhook"),
      ),
    });

    if (!integration) {
      return;
    }

    const currentConfig = normalizeGenericWebhookConfig(
      JSON.parse(integration.config) as GenericWebhookConfig,
    );

    await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(update(currentConfig)),
        updatedAt: new Date(),
      })
      .where(eq(integrationTable.id, integration.id));
  } catch (error) {
    console.error("persistWebhookHealth failed", {
      error,
      projectId,
    });
  }
}

async function deliverWebhookEvent(
  config: GenericWebhookConfig,
  eventName: string,
  taskId: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const attempt = {
    eventName,
    taskId,
    projectId,
    webhookUrl: config.webhookUrl,
  };

  try {
    await postToGenericWebhook(config.webhookUrl, payload, config.secret);

    void persistWebhookHealth(projectId, (currentConfig) => ({
      ...currentConfig,
      health: {
        ...currentConfig.health,
        lastSuccessAt: new Date().toISOString(),
        lastFailureMessage: undefined,
        lastAttempt: attempt,
      },
    }));
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);

    void persistWebhookHealth(projectId, (currentConfig) => ({
      ...currentConfig,
      health: {
        ...currentConfig.health,
        lastFailureAt: new Date().toISOString(),
        lastFailureMessage: message,
        failureCount: (currentConfig.health?.failureCount ?? 0) + 1,
        lastAttempt: attempt,
      },
    }));

    console.error("postToGenericWebhook failed", {
      error,
      eventName,
      taskId,
      projectId,
      webhookUrl: config.webhookUrl,
    });
    return false;
  }
}

async function attemptSend(
  config: GenericWebhookConfig,
  eventName: string,
  taskId: string,
  projectId: string,
  userId: string | null,
  data: Record<string, unknown>,
): Promise<SendOutcome> {
  if (isApplyingMirror()) return "skipped";

  const task = await getTaskData(taskId, projectId);
  if (!task) return "skipped";

  const actor = await getActor(userId);

  const delivered = await deliverWebhookEvent(
    config,
    eventName,
    taskId,
    projectId,
    {
      event: eventName,
      timestamp: new Date().toISOString(),
      integration: {
        type: "generic-webhook",
      },
      project: {
        id: task.projectId,
        name: task.projectName,
        workspaceId: task.workspaceId,
      },
      task: {
        id: task.id,
        number: task.number,
        title: task.title,
        status: task.status,
        statusName: task.statusName,
        priority: task.priority,
        url: task.taskUrl,
        labels: task.labels,
        type: task.issueType,
        assignee: task.assignee,
        parent: task.parent,
        mirroredFrom: task.mirroredFrom,
      },
      actor,
      data,
    },
  );
  return delivered ? "sent" : "failed";
}

type SendOutcome = "sent" | "failed" | "skipped";

// A failed delivery is not lost: it is queued and retried (see
// processWebhookRetries), so the other side being down for a deploy or a
// reboot only delays the change instead of dropping it.
async function sendEvent(
  config: GenericWebhookConfig,
  eventName: string,
  taskId: string,
  projectId: string,
  userId: string | null,
  data: Record<string, unknown>,
): Promise<boolean> {
  const outcome = await attemptSend(
    config,
    eventName,
    taskId,
    projectId,
    userId,
    data,
  );
  if (outcome === "failed") {
    await enqueueRetry({ projectId, eventName, taskId, userId, data });
  }
  return outcome === "sent";
}

export async function processWebhookRetries(): Promise<void> {
  const due = await claimDueRetries();
  for (const retry of due) {
    const integration = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, retry.projectId),
        eq(integrationTable.type, "generic-webhook"),
      ),
    });
    if (!integration || integration.isActive === false) {
      await finishRetry(retry.id);
      continue;
    }

    let outcome: SendOutcome = "failed";
    try {
      const config = normalizeGenericWebhookConfig(
        JSON.parse(integration.config) as GenericWebhookConfig,
      );
      outcome = await attemptSend(
        config,
        retry.eventName,
        retry.taskId,
        retry.projectId,
        retry.userId,
        retry.data,
      );
    } catch (error) {
      console.error("generic webhook: retry crashed", error);
    }

    if (outcome === "failed") {
      await rescheduleRetry(retry, "delivery failed");
    } else {
      await finishRetry(retry.id);
    }
  }
}

const RETRY_TICK_MS = 30_000;

export function startWebhookRetryWorker(): void {
  const timer = setInterval(() => {
    processWebhookRetries().catch((error) => {
      console.error("generic webhook: retry pass failed", error);
    });
  }, RETRY_TICK_MS);
  timer.unref?.();
}

// Top-level tasks first, then the ones that hang from another.
async function listBackfillTasks(projectId: string) {
  const tasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      description: taskTable.description,
      priority: taskTable.priority,
      status: taskTable.status,
      number: taskTable.number,
    })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));
  const children = new Set(
    (
      await db
        .select({ id: taskRelationTable.targetTaskId })
        .from(taskRelationTable)
        .innerJoin(taskTable, eq(taskRelationTable.targetTaskId, taskTable.id))
        .where(
          and(
            eq(taskRelationTable.relationType, "subtask"),
            eq(taskTable.projectId, projectId),
          ),
        )
    ).map((row) => row.id),
  );
  return [
    ...tasks.filter((task) => !children.has(task.id)),
    ...tasks.filter((task) => children.has(task.id)),
  ];
}

let backfillRunning = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One-time catch-up: sends every task of every project that has an active
// Generic Webhook as a "task.created". The other side treats that as
// get-or-create, so tasks that already exist there are left alone and the ones
// that predate the integration finally show up. Parents go first, and it is
// paced so it never floods the other instance. Returns immediately; the work
// runs in the background.
export async function runWebhookBackfill(): Promise<{
  started: boolean;
  projects: number;
}> {
  if (backfillRunning) {
    return { started: false, projects: 0 };
  }

  const integrations = await db
    .select()
    .from(integrationTable)
    .where(eq(integrationTable.type, "generic-webhook"));
  const active = integrations.filter((row) => row.isActive !== false);
  backfillRunning = true;

  void (async () => {
    try {
      for (const integration of active) {
        const config = normalizeGenericWebhookConfig(
          JSON.parse(integration.config) as GenericWebhookConfig,
        );
        const projectId = integration.projectId;
        const tasks = await listBackfillTasks(projectId);
        for (const task of tasks) {
          await sendEvent(config, "task.created", task.id, projectId, null, {
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            number: task.number,
          });
          await sleep(120);
        }
      }
    } catch (error) {
      console.error("generic webhook: backfill failed", error);
    } finally {
      backfillRunning = false;
    }
  })();

  return { started: true, projects: active.length };
}

export async function sendDueDateReminder(
  config: GenericWebhookConfig,
  taskId: string,
  projectId: string,
  leadTimeMinutes: number,
  dueDate: Date,
): Promise<boolean> {
  const normalizedConfig = normalizeGenericWebhookConfig(config);
  if (!isEnabled(normalizedConfig, "dueDateReminder")) return false;

  return sendEvent(
    normalizedConfig,
    "task.due_date_reminder",
    taskId,
    projectId,
    null,
    {
      dueDate: dueDate.toISOString(),
      leadTimeMinutes,
    },
  );
}

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskCreated")) return;

  await sendEvent(
    config,
    "task.created",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      description: event.description,
      priority: event.priority,
      status: event.status,
      number: event.number,
    },
  );
}

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskStatusChanged")) return;

  await sendEvent(
    config,
    "task.status_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    },
  );
}

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskPriorityChanged")) return;

  await sendEvent(
    config,
    "task.priority_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      oldPriority: event.oldPriority,
      newPriority: event.newPriority,
    },
  );
}

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskTitleChanged")) return;

  await sendEvent(
    config,
    "task.title_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      oldTitle: event.oldTitle,
      newTitle: event.newTitle,
    },
  );
}

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskDescriptionChanged")) return;

  await sendEvent(
    config,
    "task.description_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      oldDescription: event.oldDescription,
      newDescription: event.newDescription,
    },
  );
}

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskCommentCreated")) return;

  await sendEvent(
    config,
    "task.comment_created",
    event.taskId,
    event.projectId,
    event.userId,
    {
      comment: event.comment,
      content: event.content ?? null,
      authorName: event.authorName ?? null,
    },
  );
}

async function sendTaskDeletedEvent(
  config: GenericWebhookConfig,
  event: TaskDeletedEvent,
): Promise<boolean> {
  const [project] = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      workspaceId: projectTable.workspaceId,
    })
    .from(projectTable)
    .where(eq(projectTable.id, event.projectId))
    .limit(1);

  if (!project) return false;

  const actor = await getActor(event.userId);

  return deliverWebhookEvent(
    config,
    "task.deleted",
    event.taskId,
    event.projectId,
    {
      event: "task.deleted",
      timestamp: new Date().toISOString(),
      integration: {
        type: "generic-webhook",
      },
      project: {
        id: project.id,
        name: project.name,
        workspaceId: project.workspaceId,
      },
      task: {
        id: event.taskId,
        title: event.title,
      },
      actor,
      data: {},
    },
  );
}

export async function handleTaskDeleted(
  event: TaskDeletedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskDeleted")) return;

  await sendTaskDeletedEvent(config, event);
}

export async function handleTaskMoved(
  event: TaskMovedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskMoved")) return;

  await sendEvent(
    config,
    "task.moved",
    event.taskId,
    event.projectId,
    event.userId,
    {
      fromProjectId: event.fromProjectId,
      fromProjectName: event.fromProjectName,
      toProjectId: event.toProjectId,
      toProjectName: event.toProjectName,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    },
  );
}

// Gated by the same switch as moves. The label is what tells the other side
// which of its projects a task belongs to, so adding one has to reach it;
// the description rides along so a task labeled after creation still arrives
// complete.
export async function handleTaskLabeled(
  event: TaskLabeledEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskMoved")) return;

  const [row] = await db
    .select({ description: taskTable.description })
    .from(taskTable)
    .where(eq(taskTable.id, event.taskId))
    .limit(1);

  await sendEvent(
    config,
    "task.labeled",
    event.taskId,
    event.projectId,
    event.userId,
    { label: event.labelName, description: row?.description ?? "" },
  );
}

// Gated by the same switch as moves: turning a task into a subtask is a
// structural move, and reusing the key means integrations that already
// exist don't need to be reconfigured to get it.
export async function handleTaskParentLinked(
  event: TaskParentLinkedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskMoved")) return;

  await sendEvent(
    config,
    "task.parent_changed",
    event.taskId,
    event.projectId,
    event.userId,
    { parentTaskId: event.parentTaskId },
  );
}

export async function handleTaskDueDateChanged(
  event: TaskDueDateChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskDueDateChanged")) return;

  await sendEvent(
    config,
    "task.due_date_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      oldDueDate: event.oldDueDate,
      newDueDate: event.newDueDate,
    },
  );
}

export async function handleTaskAssigneeChanged(
  event: TaskAssigneeChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskAssigneeChanged")) return;

  await sendEvent(
    config,
    "task.assignee_changed",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
      oldAssigneeId: event.oldAssignee ?? null,
      newAssigneeId: event.newAssigneeId,
      newAssignee: event.newAssignee ?? null,
    },
  );
}

export async function handleTaskUnassigned(
  event: TaskUnassignedEvent,
  context: PluginContext,
): Promise<void> {
  const config = normalizeGenericWebhookConfig(
    context.config as GenericWebhookConfig,
  );
  if (!isEnabled(config, "taskUnassigned")) return;

  await sendEvent(
    config,
    "task.unassigned",
    event.taskId,
    event.projectId,
    event.userId,
    {
      title: event.title,
    },
  );
}
