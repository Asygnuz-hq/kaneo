import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq } from "drizzle-orm";
import db from "../database";
import { automationRuleTable } from "../database/schema";
import { subscribeToEvent } from "../events";
import { executeAutomationAction } from "./execute-action";
import type { AutomationActionType } from "./validate-automation-rule";

let engineInitialized = false;

// An action can itself publish the very event type that triggered it (e.g.
// "move to column X" publishes task.status_changed, same as a status-change
// trigger listens for) -- a rule that reacts to its own action's event would
// loop forever without this. subscribeToEvent's handlers run synchronously
// chained via awaits inside the same publishEvent -> EventEmitter.emit call
// stack, so AsyncLocalStorage correctly threads a depth counter through a
// whole trigger -> action -> trigger -> action chain.
const automationDepth = new AsyncLocalStorage<{ depth: number }>();
const MAX_AUTOMATION_DEPTH = 5;

type AutomationRuleRow = typeof automationRuleTable.$inferSelect;

async function getActiveRules(
  projectId: string,
  triggerType: string,
): Promise<AutomationRuleRow[]> {
  return db.query.automationRuleTable.findMany({
    where: and(
      eq(automationRuleTable.projectId, projectId),
      eq(automationRuleTable.triggerType, triggerType),
      eq(automationRuleTable.isActive, true),
    ),
  });
}

async function runMatchingRules(
  projectId: string,
  triggerType: string,
  taskId: string,
  actorUserId: string | null,
  matches: (triggerConfig: Record<string, unknown>) => boolean,
): Promise<void> {
  const depth = automationDepth.getStore()?.depth ?? 0;
  if (depth >= MAX_AUTOMATION_DEPTH) {
    console.warn(
      `Automation chain on task ${taskId} exceeded depth ${MAX_AUTOMATION_DEPTH}, stopping to avoid a loop`,
    );
    return;
  }

  const rules = await getActiveRules(projectId, triggerType);
  if (rules.length === 0) return;

  for (const rule of rules) {
    let triggerConfig: Record<string, unknown>;
    try {
      triggerConfig = JSON.parse(rule.triggerConfig) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (!matches(triggerConfig)) continue;

    let actionConfig: Record<string, unknown>;
    try {
      actionConfig = JSON.parse(rule.actionConfig) as Record<string, unknown>;
    } catch {
      continue;
    }

    try {
      await automationDepth.run({ depth: depth + 1 }, () =>
        executeAutomationAction({
          actionType: rule.actionType as AutomationActionType,
          actionConfig,
          taskId,
          actorUserId,
        }),
      );
    } catch (error) {
      console.error(
        `Automation rule ${rule.id} failed on task ${taskId}:`,
        error,
      );
    }
  }
}

export function initializeAutomationEngine(): void {
  if (engineInitialized) return;

  subscribeToEvent<{
    taskId: string;
    userId: string;
    projectId: string;
  }>("task.created", async (data) => {
    await runMatchingRules(
      data.projectId,
      "task.created",
      data.taskId,
      data.userId,
      () => true,
    );
  });

  subscribeToEvent<{
    taskId: string;
    userId: string | null;
    newStatus: string;
    projectId: string;
  }>("task.status_changed", async (data) => {
    await runMatchingRules(
      data.projectId,
      "task.status_changed",
      data.taskId,
      data.userId,
      (config) => !config.toStatus || config.toStatus === data.newStatus,
    );
  });

  subscribeToEvent<{
    taskId: string;
    userId: string | null;
    newPriority: string;
    projectId: string;
  }>("task.priority_changed", async (data) => {
    await runMatchingRules(
      data.projectId,
      "task.priority_changed",
      data.taskId,
      data.userId,
      (config) => !config.toPriority || config.toPriority === data.newPriority,
    );
  });

  subscribeToEvent<{
    taskId: string;
    userId: string | null;
    projectId: string;
  }>("task.assignee_changed", async (data) => {
    await runMatchingRules(
      data.projectId,
      "task.assignee_changed",
      data.taskId,
      data.userId,
      () => true,
    );
  });

  subscribeToEvent<{
    taskId: string;
    userId: string;
    projectId: string;
    label: { id: string };
  }>("task.label_assigned", async (data) => {
    await runMatchingRules(
      data.projectId,
      "task.label_assigned",
      data.taskId,
      data.userId,
      (config) => !config.labelId || config.labelId === data.label.id,
    );
  });

  engineInitialized = true;
  console.log("✓ Automation engine initialized");
}
