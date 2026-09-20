import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable, userTable } from "../../database/schema";

const DEFAULT_DAYS = 7;

// ASYGNUZ: "closed by" is the task's current assignee, not an audit-log
// lookup of who dragged the card -- simpler and matches what every other
// view in Kaneo already shows for a task's owner.
async function getWorkspaceRecentlyClosed(
  workspaceId: string,
  days = DEFAULT_DAYS,
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      closedAt: taskTable.completedAt,
      assigneeId: taskTable.userId,
      assigneeName: userTable.name,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNotNull(taskTable.completedAt),
        gte(taskTable.completedAt, since),
      ),
    )
    .orderBy(desc(taskTable.completedAt));

  return {
    totalCount: rows.length,
    tasks: rows,
  };
}

export default getWorkspaceRecentlyClosed;
