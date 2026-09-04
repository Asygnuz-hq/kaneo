import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { assertValidCustomFieldValue } from "../coerce-value";
import type { CustomFieldType } from "../validate-custom-field";

async function setTaskCustomFieldValue(
  taskId: string,
  customFieldId: string,
  value: string,
) {
  const [field] = await db
    .select()
    .from(schema.customFieldTable)
    .where(eq(schema.customFieldTable.id, customFieldId))
    .limit(1);
  if (!field) {
    throw new HTTPException(404, { message: "Custom field not found" });
  }

  const [task] = await db
    .select({
      id: schema.taskTable.id,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.taskTable.projectId, schema.projectTable.id),
    )
    .where(eq(schema.taskTable.id, taskId))
    .limit(1);
  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  // A custom field is workspace-wide, but still shouldn't be settable on a
  // task from a different workspace than the one that defined it.
  if (task.workspaceId !== field.workspaceId) {
    throw new HTTPException(400, {
      message: "This custom field does not belong to the task's workspace",
    });
  }

  assertValidCustomFieldValue(
    {
      type: field.type as CustomFieldType,
      options: field.options ? (JSON.parse(field.options) as string[]) : null,
    },
    value,
  );

  const valueWhere = and(
    eq(schema.taskCustomFieldValueTable.taskId, taskId),
    eq(schema.taskCustomFieldValueTable.customFieldId, customFieldId),
  );
  const [existing] = await db
    .select({ id: schema.taskCustomFieldValueTable.id })
    .from(schema.taskCustomFieldValueTable)
    .where(valueWhere)
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.taskCustomFieldValueTable)
      .set({ value })
      .where(valueWhere)
      .returning();
    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to update custom field value",
      });
    }
    return updated;
  }

  const [created] = await db
    .insert(schema.taskCustomFieldValueTable)
    .values({ id: createId(), taskId, customFieldId, value })
    .returning();
  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to set custom field value",
    });
  }
  return created;
}

export default setTaskCustomFieldValue;
