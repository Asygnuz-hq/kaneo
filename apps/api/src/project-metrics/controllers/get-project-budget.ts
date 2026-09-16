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

// ASYGNUZ: a lightweight spend estimate, not a full accounting module.
// Two figures are tracked from the same billable time, using two different
// per-person rates: costCents (internal cost — payroll/contractor pay) and
// billedCents (what should be invoiced to the client). budgetCents is the
// contracted amount agreed with the client, so it's compared against
// billedCents; marginCents (billed - cost) is the resulting profitability.
// The "projected total" is a simple burn-rate heuristic (billed so far / %
// complete), not a forecast model — good enough to flag "this project is
// burning through budget faster than it's finishing" without pretending to
// be an ERP.
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
      billRateCentsSnapshot: timeEntryTable.billRateCentsSnapshot,
    })
    .from(timeEntryTable)
    .innerJoin(taskTable, eq(timeEntryTable.taskId, taskTable.id))
    .where(eq(taskTable.projectId, projectId));

  let billableSeconds = 0;
  let nonBillableSeconds = 0;
  let unratedCostSeconds = 0;
  let unratedBillSeconds = 0;
  let costCents = 0;
  let billedCents = 0;

  for (const entry of entries) {
    const duration = entry.duration ?? 0;
    if (!entry.billable) {
      nonBillableSeconds += duration;
      continue;
    }
    billableSeconds += duration;

    if (entry.hourlyRateCentsSnapshot === null) {
      unratedCostSeconds += duration;
    } else {
      costCents +=
        (duration / SECONDS_PER_HOUR) * entry.hourlyRateCentsSnapshot;
    }

    if (entry.billRateCentsSnapshot === null) {
      unratedBillSeconds += duration;
    } else {
      billedCents +=
        (duration / SECONDS_PER_HOUR) * entry.billRateCentsSnapshot;
    }
  }
  costCents = Math.round(costCents);
  billedCents = Math.round(billedCents);

  const taskRows = await db
    .select({ isFinal: columnTable.isFinal })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(taskTable.projectId, projectId));

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((t) => t.isFinal === true).length;
  const completionPercentage = totalTasks > 0 ? completedTasks / totalTasks : 0;

  const projectedBilledCents =
    completionPercentage > 0
      ? Math.round(billedCents / completionPercentage)
      : null;

  return {
    budgetCents: project.budgetCents,
    currency: project.currency,
    costCents,
    billedCents,
    marginCents: billedCents - costCents,
    billableSeconds,
    nonBillableSeconds,
    unratedCostSeconds,
    unratedBillSeconds,
    projectedBilledCents,
  };
}

export default getProjectBudget;
