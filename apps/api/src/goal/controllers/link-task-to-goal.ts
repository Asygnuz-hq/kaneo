import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { goalTable, goalTaskTable, taskTable } from "../../database/schema";

async function linkTaskToGoal(goalId: string, taskId: string) {
  const goal = await db.query.goalTable.findFirst({
    where: eq(goalTable.id, goalId),
  });
  if (!goal) {
    throw new HTTPException(404, { message: "Goal not found" });
  }

  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });
  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  // The route's access middleware resolves workspace from the goal, not the
  // task, so a task from a different project could otherwise slip past it --
  // same reasoning as custom-field's cross-workspace check.
  if (task.projectId !== goal.projectId) {
    throw new HTTPException(400, {
      message: "Task must belong to the same project as the goal",
    });
  }

  const existing = await db.query.goalTaskTable.findFirst({
    where: and(
      eq(goalTaskTable.goalId, goalId),
      eq(goalTaskTable.taskId, taskId),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(goalTaskTable)
    .values({ goalId, taskId })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to link task to goal" });
  }

  return created;
}

export default linkTaskToGoal;
