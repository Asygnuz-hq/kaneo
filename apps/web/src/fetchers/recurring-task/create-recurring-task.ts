import { client } from "@kaneo/libs";

export type CreateRecurringTaskRequest = {
  projectId: string;
  name: string;
  title: string;
  description?: string;
  priority?: string;
  issueType?: string;
  labelIds?: string[];
  assigneeId?: string;
  frequency: string;
  startAt: string;
};

async function createRecurringTask(data: CreateRecurringTaskRequest) {
  const response = await client["recurring-task"].$post({ json: data });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createRecurringTask;
