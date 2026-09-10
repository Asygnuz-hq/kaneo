import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

// ASYGNUZ: marca/desmarca una tarea como bloqueada. Es una bandera aparte
// del status -- la tarea se queda en su columna, solo se pinta distinto.
// Deja rastro en la actividad y dispara task.updated para el realtime.
async function updateTaskBlocked({
  id,
  isBlocked,
  currentUserId,
}: {
  id: string;
  isBlocked: boolean;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (existingTask.isBlocked === isBlocked) {
    return existingTask;
  }

  const updatedTask = await db.transaction(async (tx) => {
    const [task] = await tx
      .update(taskTable)
      .set({ isBlocked })
      .where(eq(taskTable.id, id))
      .returning();

    if (!task) {
      throw new HTTPException(500, {
        message: "Failed to update task blocked flag",
      });
    }

    await tx.insert(activityTable).values({
      taskId: task.id,
      type: "updated",
      userId: currentUserId,
      content: null,
      eventData: { field: "isBlocked", value: isBlocked },
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

export default updateTaskBlocked;
