import { and, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { HISTORY_DAYS, projectPerson } from "../forecast";
import getWorkspaceScheduleCompliance from "./get-workspace-schedule-compliance";

const DEFAULT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNASSIGNED = "__unassigned__";

// ASYGNUZ: turns what is already on the calendar into a verdict. It compares
// each person's committed work for the next `days` (open tasks due in the
// window, plus what is already overdue) against how many tasks they actually
// closed per week over the last eight, so "can the team take what is coming?"
// has an answer instead of just a count. It reads dates and assignees only;
// it has no notion of effort, so three small tasks weigh like three big ones.
async function getWorkspaceForecast(workspaceId: string, days = DEFAULT_DAYS) {
  const now = new Date();
  const until = new Date(now.getTime() + days * DAY_MS);
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);

  const closedRows = await db
    .select({ userId: taskTable.userId })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        isNotNull(taskTable.completedAt),
        gte(taskTable.completedAt, since),
      ),
    );

  const openRows = await db
    .select({
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      status: taskTable.status,
      isFinal: columnTable.isFinal,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        isNotNull(taskTable.dueDate),
      ),
    );

  const counts = new Map<
    string,
    { closed: number; upcoming: number; overdue: number }
  >();
  const bucket = (userId: string | null) => {
    const key = userId ?? UNASSIGNED;
    const entry = counts.get(key) ?? { closed: 0, upcoming: 0, overdue: 0 };
    counts.set(key, entry);
    return entry;
  };

  for (const row of closedRows) {
    bucket(row.userId).closed++;
  }
  for (const row of openRows) {
    if (row.isFinal || row.status === "archived" || !row.dueDate) continue;
    if (row.dueDate < now) {
      bucket(row.userId).overdue++;
    } else if (row.dueDate <= until) {
      bucket(row.userId).upcoming++;
    }
  }

  const userIds = [...counts.keys()].filter((key) => key !== UNASSIGNED);
  const users = userIds.length
    ? await db
        .select({
          id: userTable.id,
          name: userTable.name,
          image: userTable.image,
        })
        .from(userTable)
        .where(inArray(userTable.id, userIds))
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));

  const people = userIds
    .map((userId) => {
      const entry = counts.get(userId);
      const user = userById.get(userId);
      return {
        userId,
        userName: user?.name ?? null,
        userImage: user?.image ?? null,
        ...projectPerson(
          {
            closedInHistory: entry?.closed ?? 0,
            upcoming: entry?.upcoming ?? 0,
            overdue: entry?.overdue ?? 0,
          },
          days,
        ),
      };
    })
    // Most stretched first: the people who need attention lead the list.
    .sort(
      (a, b) =>
        (b.utilization ?? Number.POSITIVE_INFINITY) -
          (a.utilization ?? Number.POSITIVE_INFINITY) || b.demand - a.demand,
    );

  const unassigned = counts.get(UNASSIGNED) ?? {
    closed: 0,
    upcoming: 0,
    overdue: 0,
  };

  // The team's pace counts everything closed, including work nobody was
  // assigned to, while its demand counts everything that is due.
  const totalClosed = [...counts.values()].reduce(
    (sum, entry) => sum + entry.closed,
    0,
  );
  const totalUpcoming = [...counts.values()].reduce(
    (sum, entry) => sum + entry.upcoming,
    0,
  );
  const totalOverdue = [...counts.values()].reduce(
    (sum, entry) => sum + entry.overdue,
    0,
  );

  const compliance = await getWorkspaceScheduleCompliance(workspaceId);

  return {
    windowDays: days,
    historyDays: HISTORY_DAYS,
    team: projectPerson(
      {
        closedInHistory: totalClosed,
        upcoming: totalUpcoming,
        overdue: totalOverdue,
      },
      days,
    ),
    people,
    unassigned: {
      upcoming: unassigned.upcoming,
      overdue: unassigned.overdue,
    },
    scheduleReliability: {
      onTimePercentage: compliance.onTimePercentage,
      averageDeviationDays: compliance.averageDeviationDays,
    },
  };
}

export default getWorkspaceForecast;
