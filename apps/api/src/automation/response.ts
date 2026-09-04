import { responseTimestamp, z } from "../openapi";

export const automationRuleSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    isActive: z.boolean(),
    triggerType: z.string(),
    triggerConfig: z.record(z.string(), z.unknown()),
    actionType: z.string(),
    actionConfig: z.record(z.string(), z.unknown()),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("AutomationRule");

export const automationRuleListSchema = z.array(automationRuleSchema);

export const removedAutomationRuleSchema = z
  .object({ id: z.string() })
  .openapi("RemovedAutomationRule");
