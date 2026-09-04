import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

// ASYGNUZ: marca/desmarca una tarea como hito del Gantt. Al marcarla,
// startDate se iguala a dueDate (un hito no tiene duracion) -- si la tarea
// no tenia ninguna fecha todavia, no se fuerza ninguna: simplemente no
// aparecera en el Gantt hasta que se le ponga una, igual que cualquier otra
// tarea sin fecha.
async function updateTaskMilestone({
  id,
  isMilestone,
}: {
  id: string;
  isMilestone: boolean;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const dueDate = existingTask.dueDate ?? existingTask.startDate;

  const [updatedTask] = await db
    .update(taskTable)
    .set({
      isMilestone,
      ...(isMilestone && dueDate ? { startDate: dueDate, dueDate } : {}),
    })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task milestone flag",
    });
  }

  return updatedTask;
}

export default updateTaskMilestone;
