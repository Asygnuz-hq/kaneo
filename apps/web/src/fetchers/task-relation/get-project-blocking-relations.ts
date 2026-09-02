import { client } from "@kaneo/libs";

async function getProjectBlockingRelations(projectId: string) {
  const response = await client["task-relation"].project[
    ":projectId"
  ].blocking.$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getProjectBlockingRelations;
