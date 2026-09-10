import { client } from "@kaneo/libs";

async function updateTaskBlocked(taskId: string, isBlocked: boolean) {
  const response = await client.task.blocked[":id"].$put({
    param: { id: taskId },
    json: { isBlocked },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskBlocked;
