import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { recurringTaskTable } from "../../database/schema";

async function deleteRecurringTask(id: string) {
  const [deleted] = await db
    .delete(recurringTaskTable)
    .where(eq(recurringTaskTable.id, id))
    .returning({ id: recurringTaskTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "Recurring task not found" });
  }

  return deleted;
}

export default deleteRecurringTask;
