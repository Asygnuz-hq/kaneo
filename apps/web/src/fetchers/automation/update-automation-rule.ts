import { client } from "@kaneo/libs";

export type UpdateAutomationRuleRequest = {
  id: string;
  name?: string;
  isActive?: boolean;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  actionType?: string;
  actionConfig?: Record<string, unknown>;
};

async function updateAutomationRule({
  id,
  ...body
}: UpdateAutomationRuleRequest) {
  const response = await client.automation[":id"].$put({
    param: { id },
    json: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateAutomationRule;
