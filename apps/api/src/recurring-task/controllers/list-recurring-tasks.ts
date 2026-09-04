import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { recurringTaskTable } from "../../database/schema";
import { serializeRecurringTask } from "../serialize";

async function listRecurringTasks(projectId: string) {
  const rows = await db
    .select()
    .from(recurringTaskTable)
    .where(eq(recurringTaskTable.projectId, projectId))
    .orderBy(asc(recurringTaskTable.createdAt));

  return rows.map(serializeRecurringTask);
}

export default listRecurringTasks;
