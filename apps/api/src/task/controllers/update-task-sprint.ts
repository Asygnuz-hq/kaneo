import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

// ASYGNUZ: moves a task into a sprint, or back to the backlog (sprintId
// null). Separate from the general update-task path, same as priority/status/
// assignee -- one focused write instead of threading it through the giant
// positional updateTask() signature.
async function updateTaskSprint({
  id,
  sprintId,
  currentUserId,
}: {
  id: string;
  sprintId: string | null;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (sprintId) {
    const sprint = await db.query.sprintTable.findFirst({
      where: eq(sprintTable.id, sprintId),
    });
    if (!sprint) {
      throw new HTTPException(404, { message: "Sprint not found" });
    }
    if (sprint.projectId !== existingTask.projectId) {
      throw new HTTPException(400, {
        message: "Sprint belongs to a different project",
      });
    }
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ sprintId })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task sprint",
    });
  }

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  return updatedTask;
}

export default updateTaskSprint;
