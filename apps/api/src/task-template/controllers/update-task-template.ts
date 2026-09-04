import { and, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTemplateTable } from "../../database/schema";
import { serializeTaskTemplate } from "../serialize";
import {
  assertValidIssueType,
  assertValidLabelIds,
  assertValidPriority,
} from "../validate-task-template";

async function updateTaskTemplate({
  id,
  name,
  title,
  description,
  priority,
  issueType,
  labelIds,
}: {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  priority?: string;
  issueType?: string;
  labelIds?: string[];
}) {
  const existing = await db.query.taskTemplateTable.findFirst({
    where: eq(taskTemplateTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Task template not found" });
  }

  const effectivePriority = priority ?? existing.priority;
  const effectiveIssueType = issueType ?? existing.issueType;
  const effectiveLabelIds =
    labelIds ?? (JSON.parse(existing.labelIds) as string[]);

  assertValidPriority(effectivePriority);
  assertValidIssueType(effectiveIssueType);
  await assertValidLabelIds(effectiveLabelIds, existing.projectId);

  if (name && name !== existing.name) {
    const duplicate = await db.query.taskTemplateTable.findFirst({
      where: and(
        eq(taskTemplateTable.projectId, existing.projectId),
        eq(taskTemplateTable.name, name),
        ne(taskTemplateTable.id, id),
      ),
    });
    if (duplicate) {
      throw new HTTPException(400, {
        message: `A template named "${name}" already exists in this project`,
      });
    }
  }

  const [updated] = await db
    .update(taskTemplateTable)
    .set({
      name: name ?? existing.name,
      title: title ?? existing.title,
      description: description ?? existing.description,
      priority: effectivePriority,
      issueType: effectiveIssueType,
      labelIds: JSON.stringify(effectiveLabelIds),
    })
    .where(eq(taskTemplateTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, {
      message: "Failed to update task template",
    });
  }

  return serializeTaskTemplate(updated);
}

export default updateTaskTemplate;
