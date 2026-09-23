import { and, eq } from "drizzle-orm";
import createComment from "../../activity/controllers/create-comment";
import db from "../../database";
import {
  activityTable,
  externalContactTable,
  externalTaskMirrorTable,
  taskExternalAssigneeTable,
  taskTable,
} from "../../database/schema";
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
import { localizeAssetLinks, mirrorAsset, ownApiBase } from "../assets";
import {
  financieramenteBaseUrl,
  mirrorSource,
  mirrorTargetProjectId,
} from "../config";
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

// The task is first created with just the footnote (a real task id is needed
// before any file can be attached to it); this then swaps in kaneo-mia's
// actual description, with its files copied over and its links rewritten.
async function syncDescription(
  taskId: string,
  payload: MirrorTaskPayload,
  raw?: string,
): Promise<void> {
  const original = raw ?? payload.data?.description;
  if (typeof original !== "string" || !original.trim()) {
    return;
  }
  const localized = await localizeAssetLinks(
    original,
    financieramenteBaseUrl(),
    { taskId, surface: "description" },
  );
  await db
    .update(taskTable)
    .set({ description: `${localized}\n\n${mirrorFootnote(payload)}` })
    .where(eq(taskTable.id, taskId));
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

// kaneo-mia's assignee is a real account over there with nothing matching
// it here -- assigning our own userId column would either fail (not a
// member) or silently point at the wrong person. The external-assignee
// feature already exists for exactly this (a named responsible party with
// no Kaneo account of their own), so the mirrored task gets that instead of
// a real assignment. Additive only: past assignees accumulate rather than
// being removed, since we can't tell "no longer assigned" from "removed by
// someone else" here.
async function syncExternalAssignee(
  taskId: string,
  projectId: string,
  assigneeName: string | null | undefined,
): Promise<void> {
  if (!assigneeName) {
    return;
  }
  const workspaceId = await getProjectWorkspaceId(projectId);

  const [contact] = await db
    .insert(externalContactTable)
    .values({ workspaceId, name: assigneeName })
    .onConflictDoUpdate({
      target: [externalContactTable.workspaceId, externalContactTable.name],
      set: { name: assigneeName },
    })
    .returning();
  if (!contact) {
    return;
  }

  await db
    .insert(taskExternalAssigneeTable)
    .values({ taskId, externalContactId: contact.id })
    .onConflictDoNothing({
      target: [
        taskExternalAssigneeTable.taskId,
        taskExternalAssigneeTable.externalContactId,
      ],
    });
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

  await syncDescription(created.id, payload);
  await labelWithOrigin(created.id, projectId, payload.project?.name);
  await syncExternalAssignee(
    created.id,
    projectId,
    payload.task.assignee?.name,
  );

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
      await syncDescription(localTaskId, payload, newDescription);
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

    case "task.assignee_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId) {
        return;
      }
      await syncExternalAssignee(
        localTaskId,
        mirrorTargetProjectId(),
        payload.task.assignee?.name,
      );
      return;
    }

    case "task.comment_created": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      // The comment text kaneo-mia's own webhook sends is already formatted
      // as "**<real name>** commented: > <text>" -- the actual author is in
      // there, so external.userName below only needs to say where it came
      // from, not who wrote it.
      const comment = payload.data?.comment;
      if (!localTaskId || typeof comment !== "string") {
        return;
      }
      const activity = await createComment(localTaskId, null, comment, {
        userName: "Kaneo Mia",
        source: "kaneo-mia",
      });
      const localized = await localizeAssetLinks(
        comment,
        financieramenteBaseUrl(),
        { taskId: localTaskId, activityId: activity.id, surface: "comment" },
      );
      if (localized !== comment) {
        await db
          .update(activityTable)
          .set({ content: localized })
          .where(eq(activityTable.id, activity.id));
      }
      return;
    }

    // kaneo-mia keeps attachments as their own list, with nothing in the
    // description to hang a link on -- here the only place a file can live is
    // the description text, so the copied file is appended to it as a link.
    case "task.attachment_added": {
      const localTaskId = await ensureLocalTask(payload);
      const asset = payload.data?.asset as { id?: string } | undefined;
      if (!asset?.id) {
        return;
      }
      const copied = await mirrorAsset(financieramenteBaseUrl(), asset.id, {
        taskId: localTaskId,
        surface: "description",
      });
      if (!copied) {
        return;
      }
      const [current] = await db
        .select({ description: taskTable.description })
        .from(taskTable)
        .where(eq(taskTable.id, localTaskId));
      const url = `${ownApiBase()}/asset/${copied.id}`;
      if (current?.description?.includes(url)) {
        return;
      }
      const line = copied.isImage
        ? `![${copied.filename}](${url})`
        : `[${copied.filename}](${url} "${copied.filename}")`;
      await db
        .update(taskTable)
        .set({ description: `${current?.description ?? ""}\n\n${line}` })
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
