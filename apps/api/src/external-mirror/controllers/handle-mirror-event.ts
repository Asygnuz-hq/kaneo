import { and, eq } from "drizzle-orm";
import db from "../../database";
import { externalTaskMirrorTable, taskTable } from "../../database/schema";
import createTask from "../../task/controllers/create-task";
import deleteTask from "../../task/controllers/delete-task";
import updateTaskStatus from "../../task/controllers/update-task-status";
import {
  coercePriority,
  coerceStatus,
  getValidTaskStatuses,
} from "../../task/validate-task-fields";
import { mirrorSource, mirrorTargetProjectId } from "../config";
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
