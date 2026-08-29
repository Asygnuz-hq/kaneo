import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable } from "../database/schema";

export const VALID_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const VIRTUAL_STATUSES = ["planned", "archived"] as const;

// ASYGNUZ: issue type, shown as an icon next to the task ID (Jira-style).
// "epic" is an explicit, opt-in label -- independent of whether the task
// actually has subtasks. A task can have a couple of ad-hoc subtasks (a
// checklist) without being a project-spanning epic, and vice versa a
// freshly-created epic has none yet. The list-view tree (parent/child
// nesting, expand/collapse) is unrelated: that's still built from
// "subtask" task_relation rows, on any task type.
export const VALID_ISSUE_TYPES = ["task", "story", "bug", "epic"] as const;

export function assertValidPriority(priority: string): void {
  if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HTTPException(400, {
      message: `Invalid priority "${priority}". Valid values: ${VALID_PRIORITIES.join(", ")}`,
    });
  }
}

export function assertValidIssueType(issueType: string): void {
  if (!(VALID_ISSUE_TYPES as readonly string[]).includes(issueType)) {
    throw new HTTPException(400, {
      message: `Invalid issue type "${issueType}". Valid values: ${VALID_ISSUE_TYPES.join(", ")}`,
    });
  }
}

export async function getValidTaskStatuses(
  projectId: string,
): Promise<string[]> {
  const columns = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));

  return [...columns.map((c) => c.slug), ...VIRTUAL_STATUSES];
}

export async function assertValidTaskStatus(
  status: string,
  projectId: string,
): Promise<void> {
  const validStatuses = await getValidTaskStatuses(projectId);

  if (!validStatuses.includes(status)) {
    throw new HTTPException(400, {
      message: `Invalid status "${status}". Valid statuses for this project: ${validStatuses.join(", ")}`,
    });
  }
}

export function coerceStatus(
  status: string,
  validStatuses: string[],
): { status: string; warning?: string } {
  if (validStatuses.includes(status)) {
    return { status };
  }
  return {
    status: "planned",
    warning: `Unknown status "${status}" mapped to "planned"`,
  };
}

export function coercePriority(priority: string): {
  priority: string;
  warning?: string;
} {
  if ((VALID_PRIORITIES as readonly string[]).includes(priority)) {
    return { priority };
  }
  return {
    priority: "no-priority",
    warning: `Unknown priority "${priority}" mapped to "no-priority"`,
  };
}
