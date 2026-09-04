import type { taskTemplateTable } from "../database/schema";

type TaskTemplateRow = typeof taskTemplateTable.$inferSelect;

export function serializeTaskTemplate(row: TaskTemplateRow) {
  return {
    ...row,
    labelIds: JSON.parse(row.labelIds) as string[],
  };
}
