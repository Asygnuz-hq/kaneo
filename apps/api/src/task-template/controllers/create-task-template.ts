import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTemplateTable } from "../../database/schema";
import { serializeTaskTemplate } from "../serialize";
import {
  assertValidIssueType,
  assertValidLabelIds,
  assertValidPriority,
} from "../validate-task-template";

async function createTaskTemplate({
  projectId,
  name,
  title,
  description,
  priority,
  issueType,
  labelIds,
}: {
  projectId: string;
  name: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  labelIds: string[];
}) {
  assertValidPriority(priority);
  assertValidIssueType(issueType);
  await assertValidLabelIds(labelIds, projectId);

  const existing = await db.query.taskTemplateTable.findFirst({
    where: and(
      eq(taskTemplateTable.projectId, projectId),
      eq(taskTemplateTable.name, name),
    ),
  });
  if (existing) {
    throw new HTTPException(400, {
      message: `A template named "${name}" already exists in this project`,
    });
  }

  const [countRow] = await db
    .select({ value: count() })
    .from(taskTemplateTable)
    .where(eq(taskTemplateTable.projectId, projectId));
  const position = countRow?.value ?? 0;

  const [created] = await db
    .insert(taskTemplateTable)
    .values({
      projectId,
      name,
      title,
      description,
      priority,
      issueType,
      labelIds: JSON.stringify(labelIds),
      position,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create task template",
    });
  }

  return serializeTaskTemplate(created);
}

export default createTaskTemplate;
