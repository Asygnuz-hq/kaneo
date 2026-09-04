import { client } from "@kaneo/libs";

async function listGoals(projectId: string) {
  const response = await client.goal.project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listGoals;
