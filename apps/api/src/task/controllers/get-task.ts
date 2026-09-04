import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  externalContactTable,
  taskAssigneeTable,
  taskExternalAssigneeTable,
  taskTable,
  userTable,
} from "../../database/schema";

async function getTask(taskId: string) {
  const task = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      description: taskTable.description,
      status: taskTable.status,
      priority: taskTable.priority,
      issueType: taskTable.issueType,
      sprintId: taskTable.sprintId,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      isMilestone: taskTable.isMilestone,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task.length || !task[0]) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const assignees = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(taskAssigneeTable)
    .innerJoin(userTable, eq(taskAssigneeTable.userId, userTable.id))
    .where(eq(taskAssigneeTable.taskId, taskId));

  const externalAssignees = await db
    .select({
      id: externalContactTable.id,
      name: externalContactTable.name,
    })
    .from(taskExternalAssigneeTable)
    .innerJoin(
      externalContactTable,
      eq(taskExternalAssigneeTable.externalContactId, externalContactTable.id),
    )
    .where(eq(taskExternalAssigneeTable.taskId, taskId));

  return { ...task[0], assignees, externalAssignees };
}

export default getTask;
