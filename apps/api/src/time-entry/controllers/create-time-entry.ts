import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  timeEntryTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { resolveDuration } from "../duration";

// Snapshotted at log time so a later rate change never rewrites the
// cost/bill of work already logged. Null (no rate set yet) is a valid,
// common result — the entry still counts hours, just not costed/billed
// until a rate exists.
async function resolveRateSnapshots(taskId: string, userId: string) {
  const [row] = await db
    .select({
      hourlyRateCents: workspaceUserTable.hourlyRateCents,
      billRateCents: workspaceUserTable.billRateCents,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .where(eq(taskTable.id, taskId));

  return {
    hourlyRateCentsSnapshot: row?.hourlyRateCents ?? null,
    billRateCentsSnapshot: row?.billRateCents ?? null,
  };
}

async function createTimeEntry({
  taskId,
  userId,
  description,
  startTime,
  endTime,
  billable = true,
}: {
  taskId: string;
  userId: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  billable?: boolean;
}) {
  const duration = resolveDuration(startTime, endTime);
  const { hourlyRateCentsSnapshot, billRateCentsSnapshot } =
    await resolveRateSnapshots(taskId, userId);

  const [createdTimeEntry] = await db
    .insert(timeEntryTable)
    .values({
      id: createId(),
      taskId,
      userId,
      description: description || "",
      startTime,
      endTime: endTime || null,
      duration,
      billable,
      hourlyRateCentsSnapshot,
      billRateCentsSnapshot,
    })
    .returning();

  if (!createdTimeEntry) {
    throw new HTTPException(500, {
      message: "Failed to create time entry",
    });
  }

  const [task] = await db
    .select({ userId: taskTable.userId, title: taskTable.title })
    .from(taskTable)
    .where(eq(taskTable.id, taskId));

  await publishEvent("time-entry.created", {
    timeEntryId: createdTimeEntry.id,
    taskId: createdTimeEntry.taskId,
    userId,
    type: "create",
    content: "started time tracking",
    taskOwnerId: task?.userId,
    taskTitle: task?.title,
  });

  return createdTimeEntry;
}

export default createTimeEntry;
