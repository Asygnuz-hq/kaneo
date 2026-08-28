import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";

// ASYGNUZ: taskTable.sprintId is ON DELETE SET NULL, so this sends every one
// of the sprint's tasks back to the backlog instead of deleting them.
async function deleteSprint(id: string) {
  const [deleted] = await db
    .delete(sprintTable)
    .where(eq(sprintTable.id, id))
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }

  return deleted;
}

export default deleteSprint;
