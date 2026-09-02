import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskAssigneeTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function removeTaskAssignee({
  taskId,
  userId,
  currentUserId,
}: {
  taskId: string;
  userId: string;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const existingAssignee = await db.query.taskAssigneeTable.findFirst({
    where: and(
      eq(taskAssigneeTable.taskId, taskId),
      eq(taskAssigneeTable.userId, userId),
    ),
  });

  if (!existingAssignee) {
    return existingTask;
  }

  await db
    .delete(taskAssigneeTable)
    .where(
      and(
        eq(taskAssigneeTable.taskId, taskId),
        eq(taskAssigneeTable.userId, userId),
      ),
    );

  await publishEvent("task.unassigned", {
    taskId: existingTask.id,
    projectId: existingTask.projectId,
    userId: currentUserId,
    title: existingTask.title,
    type: "unassigned",
  });

  return existingTask;
}

export default removeTaskAssignee;
