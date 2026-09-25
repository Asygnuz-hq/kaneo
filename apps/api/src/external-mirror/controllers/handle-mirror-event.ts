import { and, eq, sql } from "drizzle-orm";
import createComment from "../../activity/controllers/create-comment";
import db from "../../database";
import {
  activityTable,
  externalContactTable,
  externalTaskMirrorTable,
  taskExternalAssigneeTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import createLabel from "../../label/controllers/create-label";
import createTask from "../../task/controllers/create-task";
import deleteTask from "../../task/controllers/delete-task";
import updateTaskAssignee from "../../task/controllers/update-task-assignee";
import updateTaskDescription from "../../task/controllers/update-task-description";
import updateTaskDueDate from "../../task/controllers/update-task-due-date";
import updateTaskPriority from "../../task/controllers/update-task-priority";
import updateTaskStatus from "../../task/controllers/update-task-status";
import updateTaskTitle from "../../task/controllers/update-task-title";
import {
  coercePriority,
  coerceStatus,
  getValidTaskStatuses,
} from "../../task/validate-task-fields";
import createTaskRelation from "../../task-relation/controllers/create-task-relation";
import {
  filterAssignableUsers,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { localizeAssetLinks, mirrorAsset, ownApiBase } from "../assets";
import {
  financieramenteBaseUrl,
  mirrorSource,
  mirrorTargetProjectId,
} from "../config";
import { runAsMirror } from "../context";
import { stripMirrorFootnote } from "../footnote";
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
  // False for a task that is OURS: it has no "reflejado" note to keep.
  withFootnote = true,
): Promise<void> {
  const original = raw ?? payload.data?.description;
  if (typeof original !== "string" || !original.trim()) {
    return;
  }
  const localized = await localizeAssetLinks(
    stripMirrorFootnote(original),
    financieramenteBaseUrl(),
    { taskId, surface: "description" },
  );
  await updateTaskDescription({
    id: taskId,
    description: withFootnote
      ? `${localized}\n\n${mirrorFootnote(payload)}`
      : localized,
    currentUserId: "",
  });
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

async function clearMirroredAssignee(taskId: string): Promise<void> {
  await db
    .delete(taskExternalAssigneeTable)
    .where(eq(taskExternalAssigneeTable.taskId, taskId));
}

// A real assignment when the person also exists here (matched by email and
// actually a member of this workspace); otherwise the name-only external
// assignee. The email match is what makes "assigned to Juan" on their side
// show up as the real Juan here, with his avatar and workload.
async function syncAssignee(
  taskId: string,
  projectId: string,
  assignee: { name?: string | null; email?: string | null } | null | undefined,
): Promise<void> {
  if (!assignee?.name && !assignee?.email) {
    return;
  }
  // kaneo-mia has exactly one assignee, so the mirror holds exactly one too:
  // whoever was mirrored before is replaced, not kept alongside.
  await clearMirroredAssignee(taskId);
  const email = assignee.email?.trim();
  if (email) {
    const [user] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(sql`lower(${userTable.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (user) {
      const workspaceId = await getProjectWorkspaceId(projectId);
      const assignable = await filterAssignableUsers([user.id], workspaceId);
      if (assignable.has(user.id)) {
        await updateTaskAssignee({
          id: taskId,
          userId: user.id,
          currentUserId: "",
        });
        return;
      }
    }
  }
  await syncExternalAssignee(taskId, projectId, assignee.name);
}

// kaneo-mia's story is its historia de usuario, which is a story here too.
// Everything else is a plain task: the nesting itself lives in the
// "subtask" relation below, not in the type.
function issueTypeFor(type: string | null | undefined): string {
  return type === "story" ? "story" : "task";
}

// Hangs the local child under the local copy of its kaneo-mia parent,
// creating that copy first if the parent was never mirrored (it predates the
// integration, or its event arrived out of order).
async function linkParent(
  childLocalId: string,
  projectId: string,
  payload: MirrorTaskPayload,
): Promise<void> {
  const parent = payload.task.parent;
  if (!parent) {
    return;
  }
  const parentLocalId = await ensureLocalTask({
    ...payload,
    event: "task.created",
    task: {
      id: parent.id,
      title: parent.title,
      type: parent.type,
      status: "to-do",
      priority: "no-priority",
      parent: null,
      assignee: null,
    },
    data: {},
  });

  const [existing] = await db
    .select({ id: taskRelationTable.id })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.relationType, "subtask"),
        eq(taskRelationTable.sourceTaskId, parentLocalId),
        eq(taskRelationTable.targetTaskId, childLocalId),
      ),
    );
  if (existing) {
    return;
  }

  await createTaskRelation({
    sourceTaskId: parentLocalId,
    targetTaskId: childLocalId,
    relationType: "subtask",
    userId: "",
    workspaceId: await getProjectWorkspaceId(projectId),
  }).catch((error) => {
    // 409 = it already exists in the reverse direction; nothing to do.
    console.error("external-mirror: could not link subtask", error);
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
    issueType: issueTypeFor(payload.task.type),
  });

  await db.insert(externalTaskMirrorTable).values({
    source: mirrorSource(),
    externalTaskId: payload.task.id,
    localTaskId: created.id,
  });

  // Registered before anything else is attached: the task we just created
  // already emits its own events towards kaneo-mia, and those must find the
  // mapping instead of being mistaken for a brand-new task over there.
  // Best-effort (never throws).
  await registerReverseMirror(created.id, payload.task.id);

  await syncDescription(created.id, payload);
  await labelWithOrigin(created.id, projectId, payload.project?.name);
  await syncAssignee(created.id, projectId, payload.task.assignee);
  await linkParent(created.id, projectId, payload);

  return created.id;
}

export function handleMirrorEvent(payload: MirrorTaskPayload): Promise<void> {
  return runAsMirror(() => applyMirrorEvent(payload));
}

// A kaneo-mia task that is the mirror of one of OUR tasks (it was created
// there from ours) reports its own id here; recording the pair is what lets
// their team's changes reach the original instead of spawning a duplicate.
async function adoptMirroredFrom(payload: MirrorTaskPayload): Promise<void> {
  const ours = payload.task.mirroredFrom;
  if (!ours) {
    return;
  }
  const [task] = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.id, ours));
  if (!task) {
    return;
  }
  await db
    .insert(externalTaskMirrorTable)
    .values({
      source: mirrorSource(),
      externalTaskId: payload.task.id,
      localTaskId: task.id,
    })
    .onConflictDoNothing();
}

async function applyMirrorEvent(payload: MirrorTaskPayload): Promise<void> {
  await adoptMirroredFrom(payload);
  // Our own task, echoed back: their copy being deleted must never take the
  // original with it. Everything else they edit flows through.
  const isOurs = Boolean(payload.task.mirroredFrom);
  if (isOurs && payload.event === "task.deleted") {
    return;
  }

  switch (payload.event) {
    case "task.created": {
      await ensureLocalTask(payload);
      return;
    }

    case "task.status_changed":
    case "task.moved": {
      const localTaskId = await ensureLocalTask(payload);
      // Tasks mirrored before subtasks were supported have no link yet; any
      // later event is a chance to add it.
      await linkParent(localTaskId, mirrorTargetProjectId(), payload);
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
      await updateTaskTitle({
        id: localTaskId,
        title: payload.task.title,
        currentUserId: "",
      });
      return;
    }

    case "task.description_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      const newDescription = payload.data?.newDescription;
      if (!localTaskId || typeof newDescription !== "string") {
        return;
      }
      await syncDescription(localTaskId, payload, newDescription, !isOurs);
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
      await updateTaskPriority({
        id: localTaskId,
        priority,
        currentUserId: "",
      });
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
      await updateTaskDueDate({
        id: localTaskId,
        dueDate,
        currentUserId: "",
      });
      return;
    }

    case "task.assignee_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId) {
        return;
      }
      await syncAssignee(
        localTaskId,
        mirrorTargetProjectId(),
        payload.task.assignee,
      );
      return;
    }

    case "task.unassigned": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId) {
        return;
      }
      await clearMirroredAssignee(localTaskId);
      await updateTaskAssignee({
        id: localTaskId,
        userId: null,
        currentUserId: "",
      });
      return;
    }

    // Moved under (or to) another parent on kaneo-mia's side.
    case "task.parent_changed": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      if (!localTaskId) {
        return;
      }
      await linkParent(localTaskId, mirrorTargetProjectId(), payload);
      return;
    }

    case "task.comment_created": {
      const localTaskId = await findMirroredTaskId(payload.task.id);
      // Recreated under the name of whoever actually wrote it there, not a
      // generic "Kaneo Mia" -- the origin is kept in `source`, not the name.
      const raw = payload.data?.content ?? payload.data?.comment;
      const comment = typeof raw === "string" ? raw : undefined;
      if (!localTaskId || !comment) {
        return;
      }
      const author =
        (typeof payload.data?.authorName === "string" &&
          payload.data.authorName) ||
        payload.actor?.name ||
        "Kaneo Mia";
      const activity = await createComment(localTaskId, null, comment, {
        userName: author,
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
