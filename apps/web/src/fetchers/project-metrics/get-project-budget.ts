import { client } from "@kaneo/libs";

async function getProjectBudget(projectId: string) {
  const response = await client["project-metrics"][":projectId"].budget.$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getProjectBudget;
