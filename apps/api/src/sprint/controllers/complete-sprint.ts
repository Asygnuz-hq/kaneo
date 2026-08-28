import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, sprintTable, taskTable } from "../../database/schema";

// ASYGNUZ: marks the sprint completed and sends its unfinished tasks back to
// the backlog (sprintId: null) -- Jira's default "move to backlog" action,
// no "move to next sprint" picker in this first pass. Tasks already sitting
// in a column marked isFinal stay linked to the sprint, as a record of what
// actually got done.
async function completeSprint(id: string) {
  const sprint = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });
  if (!sprint) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }
  if (sprint.status !== "active") {
    throw new HTTPException(400, {
      message: `Cannot complete a sprint that is ${sprint.status}, not active`,
    });
  }

  const unfinishedTasks = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(
      and(
        eq(taskTable.sprintId, id),
        or(isNull(columnTable.id), eq(columnTable.isFinal, false)),
      ),
    );

  if (unfinishedTasks.length > 0) {
    await db
      .update(taskTable)
      .set({ sprintId: null })
      .where(
        inArray(
          taskTable.id,
          unfinishedTasks.map((task) => task.id),
        ),
      );
  }

  const [updated] = await db
    .update(sprintTable)
    .set({ status: "completed" })
    .where(eq(sprintTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to complete sprint" });
  }

  return { ...updated, movedToBacklog: unfinishedTasks.length };
}

export default completeSprint;
