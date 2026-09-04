import { client } from "@kaneo/libs";

async function addTaskAssignee(taskId: string, userId: string) {
  const response = await client.task.assignee[":id"][":userId"].$post({
    param: { id: taskId, userId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default addTaskAssignee;
