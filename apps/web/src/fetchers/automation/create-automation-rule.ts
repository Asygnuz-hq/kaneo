import { client } from "@kaneo/libs";

export type CreateAutomationRuleRequest = {
  projectId: string;
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
};

async function createAutomationRule(data: CreateAutomationRuleRequest) {
  const response = await client.automation.$post({ json: data });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createAutomationRule;
