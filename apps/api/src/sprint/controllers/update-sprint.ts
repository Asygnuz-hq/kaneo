import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";

// ASYGNUZ: renames/reschedules a sprint. Status changes (start/complete) go
// through their own dedicated controllers -- they have side effects (moving
// tasks, enforcing one active sprint) that a plain field update shouldn't.
async function updateSprint(
  id: string,
  fields: {
    name?: string;
    goal?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  },
) {
  const existing = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });
  if (!existing) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }

  const [updated] = await db
    .update(sprintTable)
    .set({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.goal !== undefined ? { goal: fields.goal } : {}),
      ...(fields.startDate !== undefined
        ? { startDate: fields.startDate }
        : {}),
      ...(fields.endDate !== undefined ? { endDate: fields.endDate } : {}),
    })
    .where(eq(sprintTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update sprint" });
  }

  return updated;
}

export default updateSprint;
