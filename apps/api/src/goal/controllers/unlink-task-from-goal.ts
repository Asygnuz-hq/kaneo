import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { goalTaskTable } from "../../database/schema";

async function unlinkTaskFromGoal(goalId: string, taskId: string) {
  const [deleted] = await db
    .delete(goalTaskTable)
    .where(
      and(eq(goalTaskTable.goalId, goalId), eq(goalTaskTable.taskId, taskId)),
    )
    .returning({ goalId: goalTaskTable.goalId, taskId: goalTaskTable.taskId });

  if (!deleted) {
    throw new HTTPException(404, {
      message: "Task is not linked to this goal",
    });
  }

  return deleted;
}

export default unlinkTaskFromGoal;
