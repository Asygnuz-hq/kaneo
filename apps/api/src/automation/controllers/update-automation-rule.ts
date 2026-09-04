import { eq } from "drizzle-orm";
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

async function updateAutomationRule({
  id,
  name,
  isActive,
  triggerType,
  triggerConfig,
  actionType,
  actionConfig,
}: {
  id: string;
  name?: string;
  isActive?: boolean;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  actionType?: string;
  actionConfig?: Record<string, unknown>;
}) {
  const existing = await db.query.automationRuleTable.findFirst({
    where: eq(automationRuleTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Automation rule not found" });
  }

  // Always validate the *effective* (merged) trigger/action, not just the
  // fields the caller happened to send -- otherwise e.g. changing triggerType
  // alone could leave a triggerConfig on disk that no longer makes sense for
  // the new type.
  const effectiveTriggerType = triggerType ?? existing.triggerType;
  const effectiveTriggerConfig =
    triggerConfig ??
    (JSON.parse(existing.triggerConfig) as Record<string, unknown>);
  const effectiveActionType = actionType ?? existing.actionType;
  const effectiveActionConfig =
    actionConfig ??
    (JSON.parse(existing.actionConfig) as Record<string, unknown>);

  assertValidTriggerType(effectiveTriggerType);
  assertValidActionType(effectiveActionType);
  await assertValidTriggerConfig(
    effectiveTriggerType,
    effectiveTriggerConfig,
    existing.projectId,
  );
  await assertValidActionConfig(
    effectiveActionType,
    effectiveActionConfig,
    existing.projectId,
  );

  const [updated] = await db
    .update(automationRuleTable)
    .set({
      name: name ?? existing.name,
      isActive: isActive ?? existing.isActive,
      triggerType: effectiveTriggerType,
      triggerConfig: JSON.stringify(effectiveTriggerConfig),
      actionType: effectiveActionType,
      actionConfig: JSON.stringify(effectiveActionConfig),
    })
    .where(eq(automationRuleTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, {
      message: "Failed to update automation rule",
    });
  }

  return serializeAutomationRule(updated);
}

export default updateAutomationRule;
