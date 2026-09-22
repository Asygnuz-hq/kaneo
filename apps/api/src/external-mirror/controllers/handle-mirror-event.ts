import { and, eq } from "drizzle-orm";
import db from "../../database";
import { externalTaskMirrorTable, taskTable } from "../../database/schema";
import createLabel from "../../label/controllers/create-label";
import createTask from "../../task/controllers/create-task";
import deleteTask from "../../task/controllers/delete-task";
import updateTaskStatus from "../../task/controllers/update-task-status";
import {
  coercePriority,
  coerceStatus,
  getValidTaskStatuses,
} from "../../task/validate-task-fields";
import { getProjectWorkspaceId } from "../../utils/assert-assignable-user";
import { mirrorSource, mirrorTargetProjectId } from "../config";
import { registerReverseMirror } from "../register-reverse-mirror";
import type { MirrorTaskPayload } from "../schema";

async function findMirroredTaskId(
  externalTaskId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ localTaskId: externalTaskMirrorTable.localTaskId })
    .from(externalTaskMirrorTable)
    .where(
      and(
        eq(externalTaskMirrorTable.source, mirrorSource()),
        eq(externalTaskMirrorTable.externalTaskId, externalTaskId),
      ),
    );
  return row?.localTaskId ?? null;
}

function mirrorFootnote(payload: MirrorTaskPayload): string {
  return payload.task.url
    ? `Reflejado desde Kaneo Mia: ${payload.task.url}`
    : "Reflejado desde Kaneo Mia.";
}

// Several kaneo-mia projects (Tecnología, Comisiones, Service Desk, UAT...)
// all land in this one target project here, so the origin project's name
// becomes a label -- the team tells them apart with the board's existing
// Filtrar control instead of a project switcher. Colors are picked by
// hashing the name so a newly added source project on their side gets a
// stable color automatically, with no config change needed on ours.
const LABEL_COLORS = [
  "gray",
  "dark-gray",
  "purple",
  "teal",
  "green",
  "yellow",
  "orange",
  "pink",
  "red",
] as const;

function colorForOrigin(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length] ?? "gray";
}

async function labelWithOrigin(
  taskId: string,
  projectId: string,
  originName: string | undefined,
): Promise<void> {
  if (!originName) {
    return;
  }
  const workspaceId = await getProjectWorkspaceId(projectId);
  await createLabel(
    originName,
    colorForOrigin(originName),
    taskId,
    workspaceId,
    "",
  );
}

// Creates the local task the first time we hear about an external one, and
// is safe to call again for any later event on the same external task --
// used as a get-or-create so a status/move event that arrives before we
// ever saw "task.created" (e.g. the integration was turned on after the
// task already existed) still gets mirrored instead of silently dropped.
async function ensureLocalTask(payload: MirrorTaskPayload): Promise<string> {
  const existingId = await findMirroredTaskId(payload.task.id);
  if (existingId) {
    return existingId;
  }

  const projectId = mirrorTargetProjectId();
  const validStatuses = await getValidTaskStatuses(projectId);
  const { status } = coerceStatus(
    payload.task.status ?? "to-do",
    validStatuses,
  );
  const { priority } = coercePriority(payload.task.priority ?? "no-priority");

  const created = await createTask({
    projectId,
    currentUserId: "",
    title: payload.task.title || "(sin título)",
    status,
    priority,
    description: mirrorFootnote(payload),
  });

  await db.insert(externalTaskMirrorTable).values({
    source: mirrorSource(),
    externalTaskId: payload.task.id,
    localTaskId: created.id,
  });

  await labelWithOrigin(created.id, projectId, payload.project?.name);

  // Lets our team's later status changes on this task find their way back to
  // kaneo-mia. Best-effort (never throws) -- see handleMirrorEvent's
  // idempotency check below, which is what stops that path from looping
  // back here indefinitely once both sides agree.
  await registerReverseMirror(created.id, payload.task.id);

  return created.id;
}

export async function handleMirrorEvent(
  payload: MirrorTaskPayload,
): Promise<void> {
  switch (payload.event) {
    case "task.created": {
      await ensureLocalTask(payload);
      return;
    }

    case "task.status_changed":
    case "task.moved": {
      const localTaskId = await ensureLocalTask(payload);
      const validStatuses = await getValidTaskStatuses(mirrorTargetProjectId());
      const { status } = coerceStatus(
        payload.task.status ?? "to-do",
        validStatuses,
      );

      // Idempotency is what stops the reverse sync from echoing forever:
      // when OUR team moves this task, that update is sent back to
      // kaneo-mia, which sends it right back here as this same event. Once
      // both sides already agree, stop instead of writing and re-publishing.
      const [current] = await db
        .select({ status: taskTable.status })
        .from(taskTable)
        .where(eq(taskTable.id, localTaskId));
      if (current?.status === status) {
        return;
      }

      await updateTaskStatus({ id: localTaskId, status, currentUserId: "" });
      return;
    }

    case "task.title_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId || !payload.task.title) {
        return;
      }
      await db
        .update(taskTable)
        .set({ title: payload.task.title })
        .where(eq(taskTable.id, localTaskId));
      return;
    }

    case "task.description_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      const newDescription = payload.data?.newDescription;
      if (!localTaskId || typeof newDescription !== "string") {
        return;
      }
      await db
        .update(taskTable)
        .set({ description: newDescription })
        .where(eq(taskTable.id, localTaskId));
      return;
    }

    case "task.priority_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId) {
        return;
      }
      const { priority } = coercePriority(
        payload.task.priority ?? "no-priority",
      );
      await db
        .update(taskTable)
        .set({ priority })
        .where(eq(taskTable.id, localTaskId));
      return;
    }

    case "task.due_date_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId) {
        return;
      }
      const rawDueDate = payload.data?.newDueDate;
      const dueDate =
        typeof rawDueDate === "string" ? new Date(rawDueDate) : null;
      await db
        .update(taskTable)
        .set({ dueDate })
        .where(eq(taskTable.id, localTaskId));
      return;
    }

    case "task.deleted": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId) {
        return;
      }
      await deleteTask(localTaskId, "");
      return;
    }

    default:
      return;
  }
}
