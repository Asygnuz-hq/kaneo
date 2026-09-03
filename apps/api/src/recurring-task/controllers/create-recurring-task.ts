import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { recurringTaskTable } from "../../database/schema";
import { serializeRecurringTask } from "../serialize";
import {
  assertValidAssignee,
  assertValidFrequency,
  assertValidIssueType,
  assertValidLabelIds,
  assertValidNextRunAt,
  assertValidPriority,
} from "../validate-recurring-task";

async function createRecurringTask({
  projectId,
  name,
  title,
  description,
  priority,
  issueType,
  labelIds,
  assigneeId,
  frequency,
  startAt,
}: {
  projectId: string;
  name: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  labelIds: string[];
  assigneeId?: string;
  frequency: string;
  startAt: string;
}) {
  assertValidPriority(priority);
  assertValidIssueType(issueType);
  assertValidFrequency(frequency);
  await assertValidLabelIds(labelIds, projectId);
  if (assigneeId) {
    await assertValidAssignee(assigneeId, projectId);
  }

  const nextRunAt = new Date(startAt);
  assertValidNextRunAt(nextRunAt);

  const existing = await db.query.recurringTaskTable.findFirst({
    where: and(
      eq(recurringTaskTable.projectId, projectId),
      eq(recurringTaskTable.name, name),
    ),
  });
  if (existing) {
    throw new HTTPException(400, {
      message: `A recurring task named "${name}" already exists in this project`,
    });
  }

  const [created] = await db
    .insert(recurringTaskTable)
    .values({
      projectId,
      name,
      title,
      description,
      priority,
      issueType,
      labelIds: JSON.stringify(labelIds),
      assigneeId: assigneeId ?? null,
      frequency,
      nextRunAt,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create recurring task",
    });
  }

  return serializeRecurringTask(created);
}

export default createRecurringTask;
