import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";

// ASYGNUZ: only one sprint "active" per project at a time -- classic Scrum
// board behavior. Starting a sprint is what should move its tasks onto the
// board; this endpoint only flips the status, the board/backlog UI decides
// what to show based on it.
async function startSprint(id: string) {
  const sprint = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });
  if (!sprint) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }
  if (sprint.status !== "planned") {
    throw new HTTPException(400, {
      message: `Cannot start a sprint that is already ${sprint.status}`,
    });
  }

  const [alreadyActive] = await db
    .select({ id: sprintTable.id })
    .from(sprintTable)
    .where(
      and(
        eq(sprintTable.projectId, sprint.projectId),
        eq(sprintTable.status, "active"),
      ),
    )
    .limit(1);
  if (alreadyActive) {
    throw new HTTPException(400, {
      message:
        "This project already has an active sprint. Complete it before starting another.",
    });
  }

  const [updated] = await db
    .update(sprintTable)
    .set({ status: "active" })
    .where(eq(sprintTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to start sprint" });
  }

  return updated;
}

export default startSprint;
