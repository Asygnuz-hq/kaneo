import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { parseSpec, specToDescription } from "../spec";

// ASYGNUZ: update the structured spec of a "requirement" or "story" task.
// `description` is regenerated from the spec in the same transaction so
// cards, search and exports stay in sync.
async function updateTaskSpec({
  id,
  spec,
  currentUserId,
}: {
  id: string;
  spec: unknown;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const parsed = parseSpec(existingTask.issueType, spec);
  if (!parsed) {
    throw new HTTPException(400, {
      message: `issueType "${existingTask.issueType}" does not take a structured spec, or the spec is malformed.`,
    });
  }

  const description = specToDescription(
    existingTask.issueType,
    parsed,
    existingTask.description ?? "",
  );

  const updatedTask = await db.transaction(async (tx) => {
    const [task] = await tx
      .update(taskTable)
      .set({ spec: parsed, description })
      .where(eq(taskTable.id, id))
      .returning();

    if (!task) {
      throw new HTTPException(500, { message: "Failed to update task spec" });
    }

    await tx.insert(activityTable).values({
      taskId: task.id,
      type: "updated",
      userId: currentUserId,
      content: null,
      eventData: { field: "spec" },
    });

    return task;
  });

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  return updatedTask;
}

export default updateTaskSpec;
