import { and, eq, gte, isNull, lte } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";

const DEFAULT_DAYS = 30;

type ProjectedTask = {
  id: string;
  number: number | null;
  title: string;
  projectId: string;
  projectName: string;
  dueDate: Date | null;
};

type PersonProjection = {
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  taskCount: number;
  tasks: ProjectedTask[];
};

// ASYGNUZ: only OPEN tasks due within the window count toward next month's
// projected load -- a task already closed doesn't need capacity, even if its
// dueDate happens to fall in range.
async function getWorkspaceUpcomingWorkload(
  workspaceId: string,
  days = DEFAULT_DAYS,
) {
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      dueDate: taskTable.dueDate,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
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
        gte(taskTable.dueDate, now),
        lte(taskTable.dueDate, until),
      ),
    );

  const byPerson = new Map<string, PersonProjection>();

  for (const row of rows) {
    if (row.isFinal) continue;

    const key = row.userId ?? "__unassigned__";
    const entry = byPerson.get(key) ?? {
      userId: row.userId,
      userName: row.userName,
      userImage: row.userImage,
      taskCount: 0,
      tasks: [],
    };

    entry.taskCount++;
    entry.tasks.push({
      id: row.id,
      number: row.number,
      title: row.title,
      projectId: row.projectId,
      projectName: row.projectName,
      dueDate: row.dueDate,
    });

    byPerson.set(key, entry);
  }

  return {
    windowDays: days,
    people: Array.from(byPerson.values())
      .map((entry) => ({
        ...entry,
        tasks: entry.tasks.sort(
          (a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0),
        ),
      }))
      .sort((a, b) => b.taskCount - a.taskCount),
  };
}

export default getWorkspaceUpcomingWorkload;
