import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable, labelTable } from "../database/schema";
import {
  getValidTaskStatuses,
  VALID_PRIORITIES,
} from "../task/validate-task-fields";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../utils/assert-assignable-user";

export const TRIGGER_TYPES = [
  "task.created",
  "task.status_changed",
  "task.priority_changed",
  "task.assignee_changed",
  "task.label_assigned",
] as const;
export type AutomationTriggerType = (typeof TRIGGER_TYPES)[number];

export const ACTION_TYPES = [
  "move_to_column",
  "set_priority",
  "assign_user",
  "add_label",
] as const;
export type AutomationActionType = (typeof ACTION_TYPES)[number];

export function assertValidTriggerType(
  type: string,
): asserts type is AutomationTriggerType {
  if (!(TRIGGER_TYPES as readonly string[]).includes(type)) {
    throw new HTTPException(400, {
      message: `Invalid trigger type "${type}". Valid values: ${TRIGGER_TYPES.join(", ")}`,
    });
  }
}

export function assertValidActionType(
  type: string,
): asserts type is AutomationActionType {
  if (!(ACTION_TYPES as readonly string[]).includes(type)) {
    throw new HTTPException(400, {
      message: `Invalid action type "${type}". Valid values: ${ACTION_TYPES.join(", ")}`,
    });
  }
}

// Catches a typo'd config key (e.g. "colum_id") that would otherwise be
// silently ignored, leaving the rule looking configured but never matching
// or never having anything to act on.
function assertNoUnknownKeys(
  config: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  const unknown = Object.keys(config).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new HTTPException(400, {
      message: `Unknown ${label} config key(s): ${unknown.join(", ")}`,
    });
  }
}

async function assertColumnInProject(
  columnId: string,
  projectId: string,
): Promise<void> {
  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.id, columnId),
      eq(columnTable.projectId, projectId),
    ),
  });
  if (!column) {
    throw new HTTPException(400, {
      message: "columnId does not belong to this project",
    });
  }
}

// Same relaxed match as label/controllers/get-labels-by-workspace-id.ts:
// doesn't also require taskId IS NULL, so it follows the codebase's
// existing convention rather than inventing a stricter one here.
async function assertLabelInProjectWorkspace(
  labelId: string,
  projectId: string,
): Promise<void> {
  const workspaceId = await getProjectWorkspaceId(projectId);
  const label = await db.query.labelTable.findFirst({
    where: and(
      eq(labelTable.id, labelId),
      eq(labelTable.workspaceId, workspaceId),
    ),
  });
  if (!label) {
    throw new HTTPException(400, {
      message: "labelId does not belong to this project's workspace",
    });
  }
}

export async function assertValidTriggerConfig(
  triggerType: AutomationTriggerType,
  config: Record<string, unknown>,
  projectId: string,
): Promise<void> {
  switch (triggerType) {
    case "task.created":
    case "task.assignee_changed":
      assertNoUnknownKeys(config, [], "trigger");
      return;

    case "task.status_changed": {
      assertNoUnknownKeys(config, ["toStatus"], "trigger");
      if (config.toStatus === undefined) return;
      if (typeof config.toStatus !== "string" || !config.toStatus) {
        throw new HTTPException(400, {
          message: "trigger.toStatus must be a non-empty string",
        });
      }
      const validStatuses = await getValidTaskStatuses(projectId);
      if (!validStatuses.includes(config.toStatus)) {
        throw new HTTPException(400, {
          message: `Invalid trigger.toStatus "${config.toStatus}". Valid statuses for this project: ${validStatuses.join(", ")}`,
        });
      }
      return;
    }

    case "task.priority_changed": {
      assertNoUnknownKeys(config, ["toPriority"], "trigger");
      if (config.toPriority === undefined) return;
      if (
        typeof config.toPriority !== "string" ||
        !(VALID_PRIORITIES as readonly string[]).includes(config.toPriority)
      ) {
        throw new HTTPException(400, {
          message: `Invalid trigger.toPriority. Valid values: ${VALID_PRIORITIES.join(", ")}`,
        });
      }
      return;
    }

    case "task.label_assigned": {
      assertNoUnknownKeys(config, ["labelId"], "trigger");
      if (config.labelId === undefined) return;
      if (typeof config.labelId !== "string" || !config.labelId) {
        throw new HTTPException(400, {
          message: "trigger.labelId must be a non-empty string",
        });
      }
      await assertLabelInProjectWorkspace(config.labelId, projectId);
      return;
    }
  }
}

export async function assertValidActionConfig(
  actionType: AutomationActionType,
  config: Record<string, unknown>,
  projectId: string,
): Promise<void> {
  switch (actionType) {
    case "move_to_column": {
      assertNoUnknownKeys(config, ["columnId"], "action");
      if (typeof config.columnId !== "string" || !config.columnId) {
        throw new HTTPException(400, {
          message: "action.columnId is required",
        });
      }
      await assertColumnInProject(config.columnId, projectId);
      return;
    }

    case "set_priority": {
      assertNoUnknownKeys(config, ["priority"], "action");
      if (
        typeof config.priority !== "string" ||
        !(VALID_PRIORITIES as readonly string[]).includes(config.priority)
      ) {
        throw new HTTPException(400, {
          message: `action.priority is required. Valid values: ${VALID_PRIORITIES.join(", ")}`,
        });
      }
      return;
    }

    case "assign_user": {
      assertNoUnknownKeys(config, ["userId"], "action");
      if (typeof config.userId !== "string" || !config.userId) {
        throw new HTTPException(400, {
          message: "action.userId is required",
        });
      }
      await assertAssignableUser(
        config.userId,
        await getProjectWorkspaceId(projectId),
      );
      return;
    }

    case "add_label": {
      assertNoUnknownKeys(config, ["labelId"], "action");
      if (typeof config.labelId !== "string" || !config.labelId) {
        throw new HTTPException(400, {
          message: "action.labelId is required",
        });
      }
      await assertLabelInProjectWorkspace(config.labelId, projectId);
      return;
    }
  }
}
