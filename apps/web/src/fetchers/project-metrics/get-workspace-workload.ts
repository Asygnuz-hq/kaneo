import { client } from "@kaneo/libs";

async function getWorkspaceWorkload(workspaceId: string) {
  const response = await client["project-metrics"].workspace[
    ":workspaceId"
  ].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getWorkspaceWorkload;
