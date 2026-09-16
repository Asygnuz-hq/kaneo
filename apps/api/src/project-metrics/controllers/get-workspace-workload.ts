import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";

type ProjectBreakdown = {
  projectId: string;
  projectName: string;
  openCount: number;
  totalCount: number;
};

type WorkspaceWorkloadEntry = {
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  openCount: number;
  totalCount: number;
  overdueCount: number;
  byProject: Map<string, ProjectBreakdown>;
};

// ASYGNUZ: same open/total/overdue accounting as get-project-metrics.ts, but
// summed across every non-archived project in the workspace instead of one —
// the point is seeing who is overloaded across the whole operation, not just
// within a single project's board.
async function getWorkspaceWorkload(workspaceId: string) {
  const rows = await db
    .select({
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      dueDate: taskTable.dueDate,
      userId: taskTable.userId,
      userName: userTable.name,
      userImage: userTable.image,
      isFinal: columnTable.isFinal,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
      ),
    );

  const now = new Date();
  let totalOpenTasks = 0;
  let totalOverdueTasks = 0;
  const workload = new Map<string, WorkspaceWorkloadEntry>();

  for (const row of rows) {
    const isDone = row.isFinal === true;
    const isOverdue =
      !isDone && row.dueDate !== null && row.dueDate.getTime() < now.getTime();

    if (!isDone) totalOpenTasks++;
    if (isOverdue) totalOverdueTasks++;

    const workloadKey = row.userId ?? "__unassigned__";
    const entry = workload.get(workloadKey) ?? {
      userId: row.userId,
      userName: row.userName,
      userImage: row.userImage,
      openCount: 0,
      totalCount: 0,
      overdueCount: 0,
      byProject: new Map<string, ProjectBreakdown>(),
    };

    entry.totalCount++;
    if (!isDone) entry.openCount++;
    if (isOverdue) entry.overdueCount++;

    const projectEntry = entry.byProject.get(row.projectId) ?? {
      projectId: row.projectId,
      projectName: row.projectName,
      openCount: 0,
      totalCount: 0,
    };
    projectEntry.totalCount++;
    if (!isDone) projectEntry.openCount++;
    entry.byProject.set(row.projectId, projectEntry);

    workload.set(workloadKey, entry);
  }

  return {
    totalOpenTasks,
    totalOverdueTasks,
    // Busiest (and, on ties, most-overdue) person first -- that's the point
    // of a cross-project workload view.
    workload: Array.from(workload.values())
      .map((entry) => ({
        ...entry,
        byProject: Array.from(entry.byProject.values()).sort(
          (a, b) => b.openCount - a.openCount,
        ),
      }))
      .sort(
        (a, b) => b.openCount - a.openCount || b.overdueCount - a.overdueCount,
      ),
  };
}

export default getWorkspaceWorkload;
