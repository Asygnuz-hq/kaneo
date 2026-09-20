import { and, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ASYGNUZ: only tasks that HAD a dueDate before closing are measured -- a
// task with no estimate was never late or early, there's nothing to compare.
// Deviation is calendar days, closedAt minus dueDate: positive = late,
// negative = early. Workspace-wide (every project's closed, dated work),
// not per-project -- an admin cares about overall estimate reliability
// across the whole operation, same framing as the other three reports.
async function getWorkspaceScheduleCompliance(workspaceId: string) {
  const rows = await db
    .select({
      dueDate: taskTable.dueDate,
      completedAt: taskTable.completedAt,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNotNull(taskTable.completedAt),
        isNotNull(taskTable.dueDate),
      ),
    );

  let onTimeCount = 0;
  let totalDeviationDays = 0;

  for (const row of rows) {
    if (!row.dueDate || !row.completedAt) continue;
    const deviationDays =
      (row.completedAt.getTime() - row.dueDate.getTime()) / MS_PER_DAY;
    if (deviationDays <= 0) onTimeCount++;
    totalDeviationDays += deviationDays;
  }

  const totalMeasured = rows.length;

  return {
    totalMeasured,
    onTimeCount,
    onTimePercentage:
      totalMeasured > 0
        ? Math.round((onTimeCount / totalMeasured) * 100)
        : null,
    averageDeviationDays:
      totalMeasured > 0
        ? Math.round((totalDeviationDays / totalMeasured) * 10) / 10
        : null,
  };
}

export default getWorkspaceScheduleCompliance;
