import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import { genericWebhookRetryTable } from "../../database/schema";

// 30s, 1m, 2m, 5m, 10m, 30m, 1h, 2h, 6h, 12h: rides out a deploy or reboot on
// the other side within the first few tries, and stops trying after ~a day.
export const RETRY_DELAYS_MS = [
  30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000, 7_200_000,
  21_600_000, 43_200_000,
];

// Events that describe "the task is now X". Two pending ones for the same
// task collapse into one, since the retry re-reads the task anyway.
const STATE_EVENTS = new Set([
  "task.status_changed",
  "task.moved",
  "task.priority_changed",
  "task.title_changed",
  "task.description_changed",
  "task.due_date_changed",
  "task.assignee_changed",
  "task.unassigned",
  "task.parent_changed",
]);

export type RetryEntry = {
  projectId: string;
  eventName: string;
  taskId: string;
  userId: string | null;
  data: Record<string, unknown>;
};

export type ClaimedRetry = RetryEntry & { id: string; attempts: number };

export async function enqueueRetry(entry: RetryEntry): Promise<void> {
  try {
    const data = JSON.stringify(entry.data);
    if (STATE_EVENTS.has(entry.eventName)) {
      const [existing] = await db
        .select({ id: genericWebhookRetryTable.id })
        .from(genericWebhookRetryTable)
        .where(
          and(
            eq(genericWebhookRetryTable.projectId, entry.projectId),
            eq(genericWebhookRetryTable.taskId, entry.taskId),
            eq(genericWebhookRetryTable.eventName, entry.eventName),
          ),
        )
        .limit(1);
      if (existing) {
        await db
          .update(genericWebhookRetryTable)
          .set({ data, userId: entry.userId })
          .where(eq(genericWebhookRetryTable.id, existing.id));
        return;
      }
    }
    await db.insert(genericWebhookRetryTable).values({
      projectId: entry.projectId,
      eventName: entry.eventName,
      taskId: entry.taskId,
      userId: entry.userId,
      data,
      nextAttemptAt: new Date(Date.now() + (RETRY_DELAYS_MS[0] ?? 30_000)),
    });
  } catch (error) {
    // Never let the retry bookkeeping break the action that triggered it.
    console.error("generic webhook: could not queue a retry", error);
  }
}

// Takes the due rows and pushes their next attempt out, so two instances
// (or a slow run overlapping the next tick) never send the same one twice.
export async function claimDueRetries(limit = 50): Promise<ClaimedRetry[]> {
  const result = await db.execute<{
    id: string;
    projectId: string;
    eventName: string;
    taskId: string;
    userId: string | null;
    data: string;
    attempts: number;
  }>(sql`
    UPDATE generic_webhook_retry
    SET next_attempt_at = now() + interval '5 minutes'
    WHERE id IN (
      SELECT id FROM generic_webhook_retry
      WHERE next_attempt_at <= now()
      ORDER BY next_attempt_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, project_id AS "projectId", event_name AS "eventName",
      task_id AS "taskId", user_id AS "userId", data, attempts
  `);

  return result.rows.map((row) => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      // a corrupt payload just retries with no extra data
    }
    return {
      id: row.id,
      projectId: row.projectId,
      eventName: row.eventName,
      taskId: row.taskId,
      userId: row.userId,
      data: parsed,
      attempts: row.attempts,
    };
  });
}

export async function finishRetry(id: string): Promise<void> {
  await db
    .delete(genericWebhookRetryTable)
    .where(eq(genericWebhookRetryTable.id, id));
}

// Returns true when the row was kept for another try, false when it ran out.
export async function rescheduleRetry(
  retry: ClaimedRetry,
  error: string,
): Promise<boolean> {
  const attempts = retry.attempts + 1;
  const delay = RETRY_DELAYS_MS[attempts];
  if (delay === undefined) {
    await finishRetry(retry.id);
    return false;
  }
  await db
    .update(genericWebhookRetryTable)
    .set({
      attempts,
      lastError: error.slice(0, 500),
      nextAttemptAt: new Date(Date.now() + delay),
    })
    .where(eq(genericWebhookRetryTable.id, retry.id));
  return true;
}
