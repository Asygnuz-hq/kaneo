import { eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, sprintTable } from "../../database/schema";

async function createSprint({
  projectId,
  name,
  goal,
  startDate,
  endDate,
}: {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });
  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const [maxPositionResult] = await db
    .select({ maxPosition: max(sprintTable.position) })
    .from(sprintTable)
    .where(eq(sprintTable.projectId, projectId));

  const [sprint] = await db
    .insert(sprintTable)
    .values({
      projectId,
      name,
      goal: goal || null,
      startDate: startDate || null,
      endDate: endDate || null,
      position: (maxPositionResult?.maxPosition ?? 0) + 1,
    })
    .returning();

  if (!sprint) {
    throw new HTTPException(500, { message: "Failed to create sprint" });
  }

  return sprint;
}

export default createSprint;
