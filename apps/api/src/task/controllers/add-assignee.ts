import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskAssigneeTable, taskTable, userTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";

async function addTaskAssignee({
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

  await assertAssignableUser(
    userId,
    await getProjectWorkspaceId(existingTask.projectId),
  );

  const existingAssignee = await db.query.taskAssigneeTable.findFirst({
    where: and(
      eq(taskAssigneeTable.taskId, taskId),
      eq(taskAssigneeTable.userId, userId),
    ),
  });

  if (existingAssignee) {
    return existingTask;
  }

  await db.insert(taskAssigneeTable).values({
    taskId,
    userId,
  });

  const assigneeName = (
    await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)
  )[0]?.name;

  await publishEvent("task.assignee_changed", {
    taskId: existingTask.id,
    projectId: existingTask.projectId,
    userId: currentUserId,
    oldAssignee: null,
    newAssignee: assigneeName,
    newAssigneeId: userId,
    title: existingTask.title,
    type: "assignee_changed",
  });

  return existingTask;
}

export default addTaskAssignee;
