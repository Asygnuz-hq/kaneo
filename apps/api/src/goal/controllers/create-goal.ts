import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { goalTable } from "../../database/schema";
import { assertValidGoalStatus, assertValidTargetDate } from "../validate-goal";

async function createGoal({
  projectId,
  title,
  description,
  status,
  targetDate,
}: {
  projectId: string;
  title: string;
  description: string;
  status: string;
  targetDate?: string;
}) {
  assertValidGoalStatus(status);

  let parsedTargetDate: Date | null = null;
  if (targetDate) {
    parsedTargetDate = new Date(targetDate);
    assertValidTargetDate(parsedTargetDate);
  }

  const existing = await db.query.goalTable.findFirst({
    where: and(eq(goalTable.projectId, projectId), eq(goalTable.title, title)),
  });
  if (existing) {
    throw new HTTPException(400, {
      message: `A goal titled "${title}" already exists in this project`,
    });
  }

  const [created] = await db
    .insert(goalTable)
    .values({
      projectId,
      title,
      description,
      status,
      targetDate: parsedTargetDate,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create goal" });
  }

  return { ...created, linkedTaskCount: 0, completedTaskCount: 0 };
}

export default createGoal;
