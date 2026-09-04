import { client } from "@kaneo/libs";

async function updateTaskMilestone(taskId: string, isMilestone: boolean) {
  const response = await client.task.milestone[":id"].$put({
    param: { id: taskId },
    json: { isMilestone },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskMilestone;
