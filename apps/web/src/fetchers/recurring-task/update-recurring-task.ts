import { client } from "@kaneo/libs";

export type UpdateRecurringTaskRequest = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  priority?: string;
  issueType?: string;
  labelIds?: string[];
  assigneeId?: string | null;
  frequency?: string;
  nextRunAt?: string;
  isActive?: boolean;
};

async function updateRecurringTask({
  id,
  ...body
}: UpdateRecurringTaskRequest) {
  const response = await client["recurring-task"][":id"].$put({
    param: { id },
    json: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateRecurringTask;
