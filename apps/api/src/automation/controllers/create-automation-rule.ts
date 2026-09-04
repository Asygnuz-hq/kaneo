import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { automationRuleTable } from "../../database/schema";
import { serializeAutomationRule } from "../serialize";
import {
  assertValidActionConfig,
  assertValidActionType,
  assertValidTriggerConfig,
  assertValidTriggerType,
} from "../validate-automation-rule";

async function createAutomationRule({
  projectId,
  name,
  triggerType,
  triggerConfig,
  actionType,
  actionConfig,
}: {
  projectId: string;
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
}) {
  assertValidTriggerType(triggerType);
  assertValidActionType(actionType);
  await assertValidTriggerConfig(triggerType, triggerConfig, projectId);
  await assertValidActionConfig(actionType, actionConfig, projectId);

  const [created] = await db
    .insert(automationRuleTable)
    .values({
      projectId,
      name,
      triggerType,
      triggerConfig: JSON.stringify(triggerConfig),
      actionType,
      actionConfig: JSON.stringify(actionConfig),
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create automation rule",
    });
  }

  return serializeAutomationRule(created);
}

export default createAutomationRule;
