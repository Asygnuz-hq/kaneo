import { eq } from "drizzle-orm";
import db from "../database";
import { columnTable } from "../database/schema";
import assignLabelToTask from "../label/controllers/assign-label-to-task";
import updateTaskAssignee from "../task/controllers/update-task-assignee";
import updateTaskPriority from "../task/controllers/update-task-priority";
import updateTaskStatus from "../task/controllers/update-task-status";
import type { AutomationActionType } from "./validate-automation-rule";

// The task-update controllers below want a "who did this" id for event
// attribution only -- it's never looked up as a real user (see
// notification/index.ts: notifications target the assignee, not this
// actor). When the triggering event itself had no human actor (a null
// userId, e.g. a system-driven change), fall back to this sentinel rather
// than crashing the automation.
const AUTOMATION_ACTOR_FALLBACK = "automation";

export async function executeAutomationAction({
  actionType,
  actionConfig,
  taskId,
  actorUserId,
}: {
  actionType: AutomationActionType;
  actionConfig: Record<string, unknown>;
  taskId: string;
  actorUserId: string | null;
}): Promise<void> {
  const currentUserId = actorUserId ?? AUTOMATION_ACTOR_FALLBACK;

  switch (actionType) {
    case "move_to_column": {
      const columnId = actionConfig.columnId as string;
      const column = await db.query.columnTable.findFirst({
        where: eq(columnTable.id, columnId),
      });
      // The column the rule points at may have been deleted/renamed since
      // the rule was created -- skip rather than throw, same spirit as the
      // per-plugin try/catch in plugins/registry.ts's broadcast* functions.
      if (!column) return;
      await updateTaskStatus({
        id: taskId,
        status: column.slug,
        currentUserId,
      });
      return;
    }

    case "set_priority": {
      await updateTaskPriority({
        id: taskId,
        priority: actionConfig.priority as string,
        currentUserId,
      });
      return;
    }

    case "assign_user": {
      await updateTaskAssignee({
        id: taskId,
        userId: actionConfig.userId as string,
        currentUserId,
      });
      return;
    }

    case "add_label": {
      await assignLabelToTask(
        actionConfig.labelId as string,
        taskId,
        currentUserId,
      );
      return;
    }
  }
}
