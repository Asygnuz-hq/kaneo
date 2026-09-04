import { and, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  goalTable,
  goalTaskTable,
  taskTable,
} from "../../database/schema";
import { assertValidGoalStatus, assertValidTargetDate } from "../validate-goal";

async function updateGoal({
  id,
  title,
  description,
  status,
  targetDate,
}: {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  // undefined = leave as-is, null = clear, string = set to this date
  targetDate?: string | null;
}) {
  const existing = await db.query.goalTable.findFirst({
    where: eq(goalTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Goal not found" });
  }

  const effectiveStatus = status ?? existing.status;
  assertValidGoalStatus(effectiveStatus);

  let effectiveTargetDate = existing.targetDate;
  if (targetDate === null) {
    effectiveTargetDate = null;
  } else if (targetDate !== undefined) {
    effectiveTargetDate = new Date(targetDate);
    assertValidTargetDate(effectiveTargetDate);
  }

  if (title && title !== existing.title) {
    const duplicate = await db.query.goalTable.findFirst({
      where: and(
        eq(goalTable.projectId, existing.projectId),
        eq(goalTable.title, title),
        ne(goalTable.id, id),
      ),
    });
    if (duplicate) {
      throw new HTTPException(400, {
        message: `A goal titled "${title}" already exists in this project`,
      });
    }
  }

  const [updated] = await db
    .update(goalTable)
    .set({
      title: title ?? existing.title,
      description: description ?? existing.description,
      status: effectiveStatus,
      targetDate: effectiveTargetDate,
    })
    .where(eq(goalTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update goal" });
  }

  const linkedTaskRows = await db
    .select({ isFinal: columnTable.isFinal })
    .from(goalTaskTable)
    .innerJoin(taskTable, eq(goalTaskTable.taskId, taskTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(goalTaskTable.goalId, id));

  return {
    ...updated,
    linkedTaskCount: linkedTaskRows.length,
    completedTaskCount: linkedTaskRows.filter((row) => row.isFinal === true)
      .length,
  };
}

export default updateGoal;
