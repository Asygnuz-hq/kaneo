import { and, eq, ne } from "drizzle-orm";
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

async function updateRecurringTask({
  id,
  name,
  title,
  description,
  priority,
  issueType,
  labelIds,
  assigneeId,
  frequency,
  nextRunAt,
  isActive,
}: {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  priority?: string;
  issueType?: string;
  labelIds?: string[];
  assigneeId?: string | null;
  frequency?: string;
  nextRunAt?: string;
  isActive?: boolean;
}) {
  const existing = await db.query.recurringTaskTable.findFirst({
    where: eq(recurringTaskTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Recurring task not found" });
  }

  const effectivePriority = priority ?? existing.priority;
  const effectiveIssueType = issueType ?? existing.issueType;
  const effectiveFrequency = frequency ?? existing.frequency;
  const effectiveLabelIds =
    labelIds ?? (JSON.parse(existing.labelIds) as string[]);
  const effectiveAssigneeId =
    assigneeId === undefined ? existing.assigneeId : assigneeId;

  assertValidPriority(effectivePriority);
  assertValidIssueType(effectiveIssueType);
  assertValidFrequency(effectiveFrequency);
  await assertValidLabelIds(effectiveLabelIds, existing.projectId);
  if (effectiveAssigneeId) {
    await assertValidAssignee(effectiveAssigneeId, existing.projectId);
  }

  let effectiveNextRunAt = existing.nextRunAt;
  if (nextRunAt !== undefined) {
    effectiveNextRunAt = new Date(nextRunAt);
    assertValidNextRunAt(effectiveNextRunAt);
  }

  if (name && name !== existing.name) {
    const duplicate = await db.query.recurringTaskTable.findFirst({
      where: and(
        eq(recurringTaskTable.projectId, existing.projectId),
        eq(recurringTaskTable.name, name),
        ne(recurringTaskTable.id, id),
      ),
    });
    if (duplicate) {
      throw new HTTPException(400, {
        message: `A recurring task named "${name}" already exists in this project`,
      });
    }
  }

  const [updated] = await db
    .update(recurringTaskTable)
    .set({
      name: name ?? existing.name,
      title: title ?? existing.title,
      description: description ?? existing.description,
      priority: effectivePriority,
      issueType: effectiveIssueType,
      labelIds: JSON.stringify(effectiveLabelIds),
      assigneeId: effectiveAssigneeId,
      frequency: effectiveFrequency,
      nextRunAt: effectiveNextRunAt,
      isActive: isActive ?? existing.isActive,
    })
    .where(eq(recurringTaskTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, {
      message: "Failed to update recurring task",
    });
  }

  return serializeRecurringTask(updated);
}

export default updateRecurringTask;
