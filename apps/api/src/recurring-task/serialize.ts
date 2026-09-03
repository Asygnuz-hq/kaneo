import type { recurringTaskTable } from "../database/schema";

type RecurringTaskRow = typeof recurringTaskTable.$inferSelect;

export function serializeRecurringTask(row: RecurringTaskRow) {
  return {
    ...row,
    labelIds: JSON.parse(row.labelIds) as string[],
  };
}
