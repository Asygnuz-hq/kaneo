import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";

// The full set of a project's tasks, for the "link a task to this goal"
// picker. The frontend already has the goal's currently-linked tasks (from
// list-goal-tasks) and filters those out client-side, so this stays a plain
// project-wide list rather than taking a goalId to exclude.
async function listAvailableTasks(projectId: string) {
  return db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
    })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId))
    .orderBy(asc(taskTable.number));
}

export default listAvailableTasks;
