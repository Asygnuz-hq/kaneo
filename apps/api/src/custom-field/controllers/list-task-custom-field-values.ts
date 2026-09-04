import { eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function listTaskCustomFieldValues(taskId: string) {
  return db
    .select()
    .from(schema.taskCustomFieldValueTable)
    .where(eq(schema.taskCustomFieldValueTable.taskId, taskId));
}

export default listTaskCustomFieldValues;
