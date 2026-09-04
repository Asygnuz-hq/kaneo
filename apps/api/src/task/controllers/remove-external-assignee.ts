import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskExternalAssigneeTable, taskTable } from "../../database/schema";

async function removeTaskExternalAssignee({
  taskId,
  externalContactId,
}: {
  taskId: string;
  externalContactId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await db
    .delete(taskExternalAssigneeTable)
    .where(
      and(
        eq(taskExternalAssigneeTable.taskId, taskId),
        eq(taskExternalAssigneeTable.externalContactId, externalContactId),
      ),
    );

  return existingTask;
}

export default removeTaskExternalAssignee;
