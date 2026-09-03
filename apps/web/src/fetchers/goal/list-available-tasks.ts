import { client } from "@kaneo/libs";

async function listAvailableTasks(projectId: string) {
  const response = await client.goal.project[":projectId"][
    "available-tasks"
  ].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listAvailableTasks;
