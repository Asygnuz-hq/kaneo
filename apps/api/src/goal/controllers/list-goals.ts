import { asc, eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  goalTable,
  goalTaskTable,
  taskTable,
} from "../../database/schema";

async function listGoals(projectId: string) {
  const goals = await db
    .select()
    .from(goalTable)
    .where(eq(goalTable.projectId, projectId))
    .orderBy(asc(goalTable.position));

  if (goals.length === 0) return [];

  const goalIds = goals.map((goal) => goal.id);

  const linkedTaskRows = await db
    .select({
      goalId: goalTaskTable.goalId,
      isFinal: columnTable.isFinal,
    })
    .from(goalTaskTable)
    .innerJoin(taskTable, eq(goalTaskTable.taskId, taskTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(inArray(goalTaskTable.goalId, goalIds));

  const counts = new Map<string, { total: number; completed: number }>();
  for (const row of linkedTaskRows) {
    const entry = counts.get(row.goalId) ?? { total: 0, completed: 0 };
    entry.total++;
    if (row.isFinal === true) entry.completed++;
    counts.set(row.goalId, entry);
  }

  return goals.map((goal) => {
    const count = counts.get(goal.id) ?? { total: 0, completed: 0 };
    return {
      ...goal,
      linkedTaskCount: count.total,
      completedTaskCount: count.completed,
    };
  });
}

export default listGoals;
