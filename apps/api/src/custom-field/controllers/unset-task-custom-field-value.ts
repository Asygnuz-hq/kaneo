import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

async function unsetTaskCustomFieldValue(
  taskId: string,
  customFieldId: string,
) {
  const [deleted] = await db
    .delete(schema.taskCustomFieldValueTable)
    .where(
      and(
        eq(schema.taskCustomFieldValueTable.taskId, taskId),
        eq(schema.taskCustomFieldValueTable.customFieldId, customFieldId),
      ),
    )
    .returning({ id: schema.taskCustomFieldValueTable.id });

  if (!deleted) {
    throw new HTTPException(404, {
      message: "This task has no value set for that custom field",
    });
  }

  return { taskId, customFieldId };
}

export default unsetTaskCustomFieldValue;
