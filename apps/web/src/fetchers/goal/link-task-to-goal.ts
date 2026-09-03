import { client } from "@kaneo/libs";

async function linkTaskToGoal(goalId: string, taskId: string) {
  const response = await client.goal[":id"].tasks.$post({
    param: { id: goalId },
    json: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default linkTaskToGoal;
