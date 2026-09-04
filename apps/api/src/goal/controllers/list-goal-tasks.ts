import { eq } from "drizzle-orm";
import db from "../../database";
import { columnTable, goalTaskTable, taskTable } from "../../database/schema";

async function listGoalTasks(goalId: string) {
  const rows = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      status: taskTable.status,
      number: taskTable.number,
      isFinal: columnTable.isFinal,
    })
    .from(goalTaskTable)
    .innerJoin(taskTable, eq(goalTaskTable.taskId, taskTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(goalTaskTable.goalId, goalId));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    number: row.number,
    isDone: row.isFinal === true,
  }));
}

export default listGoalTasks;
