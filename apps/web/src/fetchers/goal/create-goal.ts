import { client } from "@kaneo/libs";

export type CreateGoalRequest = {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  targetDate?: string;
};

async function createGoal(data: CreateGoalRequest) {
  const response = await client.goal.$post({ json: data });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createGoal;
