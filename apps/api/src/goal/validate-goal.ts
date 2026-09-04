import { HTTPException } from "hono/http-exception";

export const VALID_GOAL_STATUSES = [
  "on-track",
  "at-risk",
  "off-track",
  "done",
] as const;
export type GoalStatus = (typeof VALID_GOAL_STATUSES)[number];

export function assertValidGoalStatus(
  status: string,
): asserts status is GoalStatus {
  if (!(VALID_GOAL_STATUSES as readonly string[]).includes(status)) {
    throw new HTTPException(400, {
      message: `Invalid status "${status}". Valid values: ${VALID_GOAL_STATUSES.join(", ")}`,
    });
  }
}

export function assertValidTargetDate(value: Date): void {
  if (Number.isNaN(value.getTime())) {
    throw new HTTPException(400, {
      message: "targetDate is not a valid date",
    });
  }
}
