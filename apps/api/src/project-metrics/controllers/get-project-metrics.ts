import { eq } from "drizzle-orm";
import db from "../../database";
import { columnTable, taskTable, userTable } from "../../database/schema";

type WorkloadEntry = {
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  openCount: number;
  totalCount: number;
};

async function getProjectMetrics(projectId: string) {
  const rows = await db
    .select({
      status: taskTable.status,
      priority: taskTable.priority,
      dueDate: taskTable.dueDate,
      userId: taskTable.userId,
      userName: userTable.name,
      userImage: userTable.image,
      columnName: columnTable.name,
      isFinal: columnTable.isFinal,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(taskTable.projectId, projectId));

  const now = new Date();
  let completedTasks = 0;
  let overdueTasks = 0;

  const statusCounts = new Map<
    string,
    { columnName: string | null; count: number }
  >();
  const priorityCounts = new Map<string, number>();
  const workload = new Map<string, WorkloadEntry>();

  for (const row of rows) {
    // A column without isFinal set (e.g. the task sits in the virtual
    // "planned"/"archived" bucket with no columnId) is never "done".
    const isDone = row.isFinal === true;
    if (isDone) completedTasks++;
    if (!isDone && row.dueDate && row.dueDate.getTime() < now.getTime()) {
      overdueTasks++;
    }

    const statusEntry = statusCounts.get(row.status) ?? {
      columnName: row.columnName,
      count: 0,
    };
    statusEntry.count++;
    statusCounts.set(row.status, statusEntry);

    priorityCounts.set(
      row.priority,
      (priorityCounts.get(row.priority) ?? 0) + 1,
    );

    const workloadKey = row.userId ?? "__unassigned__";
    const workloadEntry = workload.get(workloadKey) ?? {
      userId: row.userId,
      userName: row.userName,
      userImage: row.userImage,
      openCount: 0,
      totalCount: 0,
    };
    workloadEntry.totalCount++;
    if (!isDone) workloadEntry.openCount++;
    workload.set(workloadKey, workloadEntry);
  }

  return {
    totalTasks: rows.length,
    completedTasks,
    overdueTasks,
    statusCounts: Array.from(statusCounts, ([status, value]) => ({
      status,
      ...value,
    })),
    priorityCounts: Array.from(priorityCounts, ([priority, count]) => ({
      priority,
      count,
    })),
    // Busiest person first -- the point of a workload view.
    workload: Array.from(workload.values()).sort(
      (a, b) => b.openCount - a.openCount,
    ),
  };
}

export default getProjectMetrics;
