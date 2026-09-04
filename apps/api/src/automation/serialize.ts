import type { automationRuleTable } from "../database/schema";

type AutomationRuleRow = typeof automationRuleTable.$inferSelect;

// The DB stores trigger/action config as a JSON string (same reasoning as
// custom-field's `options` column: one generic text column instead of a
// migration per new trigger/action kind). This is the single place that
// turns it back into an object for API responses.
export function serializeAutomationRule(row: AutomationRuleRow) {
  return {
    ...row,
    triggerConfig: JSON.parse(row.triggerConfig) as Record<string, unknown>,
    actionConfig: JSON.parse(row.actionConfig) as Record<string, unknown>,
  };
}
