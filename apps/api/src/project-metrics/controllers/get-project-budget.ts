import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  timeEntryTable,
} from "../../database/schema";

const SECONDS_PER_HOUR = 3600;

// ASYGNUZ: a lightweight spend estimate, not a full accounting module —
// cost is derived from billable time already logged (hours x the rate
// snapshotted when each entry was created), and the "projected total" is a
// simple burn-rate heuristic (spend so far / % complete), not a forecast
// model. Good enough to flag "this project is burning through budget faster
// than it's finishing" without pretending to be an ERP.
async function getProjectBudget(projectId: string) {
  const [project] = await db
    .select({
      budgetCents: projectTable.budgetCents,
      currency: projectTable.currency,
    })
    .from(projectTable)
    .where(eq(projectTable.id, projectId));

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const entries = await db
    .select({
      duration: timeEntryTable.duration,
      billable: timeEntryTable.billable,
      hourlyRateCentsSnapshot: timeEntryTable.hourlyRateCentsSnapshot,
    })
    .from(timeEntryTable)
    .innerJoin(taskTable, eq(timeEntryTable.taskId, taskTable.id))
    .where(eq(taskTable.projectId, projectId));

  let billableSeconds = 0;
  let nonBillableSeconds = 0;
  let unratedBillableSeconds = 0;
  let spentCents = 0;

  for (const entry of entries) {
    const duration = entry.duration ?? 0;
    if (!entry.billable) {
      nonBillableSeconds += duration;
      continue;
    }
    billableSeconds += duration;
    if (entry.hourlyRateCentsSnapshot === null) {
      unratedBillableSeconds += duration;
      continue;
    }
    spentCents += (duration / SECONDS_PER_HOUR) * entry.hourlyRateCentsSnapshot;
  }
  spentCents = Math.round(spentCents);

  const taskRows = await db
    .select({ isFinal: columnTable.isFinal })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(taskTable.projectId, projectId));

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((t) => t.isFinal === true).length;
  const completionPercentage = totalTasks > 0 ? completedTasks / totalTasks : 0;

  const projectedTotalCents =
    completionPercentage > 0
      ? Math.round(spentCents / completionPercentage)
      : null;

  return {
    budgetCents: project.budgetCents,
    currency: project.currency,
    spentCents,
    billableSeconds,
    nonBillableSeconds,
    unratedBillableSeconds,
    projectedTotalCents,
  };
}

export default getProjectBudget;
