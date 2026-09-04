import { and, asc, eq, lte } from "drizzle-orm";
import db from "../database";
import { columnTable, recurringTaskTable } from "../database/schema";
import assignLabelToTask from "../label/controllers/assign-label-to-task";
import type { RecurringTaskFrequency } from "../recurring-task/validate-recurring-task";
import createTask from "../task/controllers/create-task";

// Recurring tasks are created by the scheduler, not a person -- there is no
// real "current user" for event attribution. Same reasoning as the
// automation engine's actor fallback: this is only ever read back as plain
// text on the published event, never looked up as a real user row.
const SCHEDULER_ACTOR = "recurring-task-scheduler";

function advanceOnce(date: Date, frequency: RecurringTaskFrequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next;
  }
}

// Jumps straight to the next occurrence *after* `now`, skipping any that were
// missed (e.g. the server was down) rather than firing a burst of catch-up
// tasks -- the same "don't backfill" behavior most recurring-task tools use.
export function computeNextRunAt(
  current: Date,
  frequency: RecurringTaskFrequency,
  now: Date,
): Date {
  let next = advanceOnce(current, frequency);
  while (next.getTime() <= now.getTime()) {
    next = advanceOnce(next, frequency);
  }
  return next;
}

async function getDefaultColumnSlug(projectId: string): Promise<string> {
  const column = await db.query.columnTable.findFirst({
    where: eq(columnTable.projectId, projectId),
    orderBy: asc(columnTable.position),
  });
  return column?.slug ?? "to-do";
}

async function processDueRecurringTask(row: {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  labelIds: string;
  assigneeId: string | null;
  frequency: string;
  nextRunAt: Date;
}): Promise<void> {
  const frequency = row.frequency as RecurringTaskFrequency;
  const now = new Date();
  const newNextRunAt = computeNextRunAt(row.nextRunAt, frequency, now);

  // Optimistic claim: only proceed if next_run_at still matches what we just
  // read. If another instance already claimed and advanced this row, this
  // update touches zero rows and we skip -- no shared lock table needed.
  const [claimed] = await db
    .update(recurringTaskTable)
    .set({ nextRunAt: newNextRunAt, lastRunAt: now })
    .where(
      and(
        eq(recurringTaskTable.id, row.id),
        eq(recurringTaskTable.nextRunAt, row.nextRunAt),
      ),
    )
    .returning({ id: recurringTaskTable.id });

  if (!claimed) return;

  const status = await getDefaultColumnSlug(row.projectId);

  const task = await createTask({
    projectId: row.projectId,
    currentUserId: SCHEDULER_ACTOR,
    userId: row.assigneeId ?? undefined,
    title: row.title,
    status,
    description: row.description,
    priority: row.priority,
    issueType: row.issueType,
  });

  const labelIds = JSON.parse(row.labelIds) as string[];
  for (const labelId of labelIds) {
    try {
      await assignLabelToTask(labelId, task.id, SCHEDULER_ACTOR);
    } catch (error) {
      console.error("Failed to attach label to recurring task instance", {
        recurringTaskId: row.id,
        taskId: task.id,
        labelId,
        error,
      });
    }
  }
}

export async function checkRecurringTasks(): Promise<{ degraded: boolean }> {
  let degraded = false;

  const dueRows = await db
    .select()
    .from(recurringTaskTable)
    .where(
      and(
        eq(recurringTaskTable.isActive, true),
        lte(recurringTaskTable.nextRunAt, new Date()),
      ),
    );

  for (const row of dueRows) {
    try {
      await processDueRecurringTask(row);
    } catch (error) {
      degraded = true;
      console.error("Failed to process recurring task", {
        recurringTaskId: row.id,
        error,
      });
    }
  }

  return { degraded };
}
