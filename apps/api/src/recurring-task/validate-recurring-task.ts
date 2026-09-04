import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { labelTable } from "../database/schema";
import {
  VALID_ISSUE_TYPES,
  VALID_PRIORITIES,
} from "../task/validate-task-fields";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../utils/assert-assignable-user";

export const VALID_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type RecurringTaskFrequency = (typeof VALID_FREQUENCIES)[number];

export function assertValidFrequency(
  frequency: string,
): asserts frequency is RecurringTaskFrequency {
  if (!(VALID_FREQUENCIES as readonly string[]).includes(frequency)) {
    throw new HTTPException(400, {
      message: `Invalid frequency "${frequency}". Valid values: ${VALID_FREQUENCIES.join(", ")}`,
    });
  }
}

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

export function assertValidNextRunAt(value: Date): void {
  if (Number.isNaN(value.getTime())) {
    throw new HTTPException(400, { message: "nextRunAt is not a valid date" });
  }
}

export async function assertValidLabelIds(
  labelIds: string[],
  projectId: string,
): Promise<void> {
  if (labelIds.length === 0) return;

  const uniqueIds = new Set(labelIds);
  if (uniqueIds.size !== labelIds.length) {
    throw new HTTPException(400, {
      message: "labelIds must not contain duplicates",
    });
  }

  const workspaceId = await getProjectWorkspaceId(projectId);
  const rows = await db.query.labelTable.findMany({
    where: and(
      eq(labelTable.workspaceId, workspaceId),
      inArray(labelTable.id, [...uniqueIds]),
    ),
  });
  const validIds = new Set(rows.map((row) => row.id));
  const unknown = labelIds.filter((id) => !validIds.has(id));
  if (unknown.length > 0) {
    throw new HTTPException(400, {
      message: `labelIds not found in this project's workspace: ${unknown.join(", ")}`,
    });
  }
}

export async function assertValidAssignee(
  assigneeId: string,
  projectId: string,
): Promise<void> {
  await assertAssignableUser(
    assigneeId,
    await getProjectWorkspaceId(projectId),
  );
}
