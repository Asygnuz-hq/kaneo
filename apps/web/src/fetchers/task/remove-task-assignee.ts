import { client } from "@kaneo/libs";

async function removeTaskAssignee(taskId: string, userId: string) {
  const response = await client.task.assignee[":id"][":userId"].$delete({
    param: { id: taskId, userId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default removeTaskAssignee;
