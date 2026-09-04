import { client } from "@kaneo/libs";

async function listTaskTemplates(projectId: string) {
  const response = await client["task-template"].project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listTaskTemplates;
