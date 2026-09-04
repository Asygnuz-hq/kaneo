import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  externalContactTable,
  projectTable,
  taskExternalAssigneeTable,
  taskTable,
} from "../../database/schema";

async function addTaskExternalAssignee({
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

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, existingTask.projectId))
    .limit(1);

  const contact = await db.query.externalContactTable.findFirst({
    where: eq(externalContactTable.id, externalContactId),
  });

  if (!contact || contact.workspaceId !== project?.workspaceId) {
    throw new HTTPException(404, {
      message: "External contact is not part of this task's workspace",
    });
  }

  const existingAssignment = await db.query.taskExternalAssigneeTable.findFirst(
    {
      where: and(
        eq(taskExternalAssigneeTable.taskId, taskId),
        eq(taskExternalAssigneeTable.externalContactId, externalContactId),
      ),
    },
  );

  if (existingAssignment) {
    return existingTask;
  }

  await db.insert(taskExternalAssigneeTable).values({
    taskId,
    externalContactId,
  });

  return existingTask;
}

export default addTaskExternalAssignee;
