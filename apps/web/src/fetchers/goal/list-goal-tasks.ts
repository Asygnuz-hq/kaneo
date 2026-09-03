import { client } from "@kaneo/libs";

async function listGoalTasks(goalId: string) {
  const response = await client.goal[":id"].tasks.$get({
    param: { id: goalId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listGoalTasks;
