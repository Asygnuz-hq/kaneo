import { client } from "@kaneo/libs";

async function listAutomationRules(projectId: string) {
  const response = await client.automation.project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listAutomationRules;
