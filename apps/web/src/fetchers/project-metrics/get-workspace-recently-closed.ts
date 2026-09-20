import { client } from "@kaneo/libs";

async function getWorkspaceRecentlyClosed(workspaceId: string, days?: number) {
  const response = await client["project-metrics"].workspace[":workspaceId"][
    "recently-closed"
  ].$get({
    param: { workspaceId },
    query: days ? { days: String(days) } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getWorkspaceRecentlyClosed;
