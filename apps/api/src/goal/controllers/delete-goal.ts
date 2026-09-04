import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { goalTable } from "../../database/schema";

async function deleteGoal(id: string) {
  const [deleted] = await db
    .delete(goalTable)
    .where(eq(goalTable.id, id))
    .returning({ id: goalTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "Goal not found" });
  }

  return deleted;
}

export default deleteGoal;
