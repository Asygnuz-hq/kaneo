import { client } from "@kaneo/libs";

async function unlinkTaskFromGoal(goalId: string, taskId: string) {
  const response = await client.goal[":id"].tasks[":taskId"].$delete({
    param: { id: goalId, taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default unlinkTaskFromGoal;
