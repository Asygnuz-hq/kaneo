import { client } from "@kaneo/libs";

export type UpdateGoalRequest = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  targetDate?: string | null;
};

async function updateGoal({ id, ...body }: UpdateGoalRequest) {
  const response = await client.goal[":id"].$put({
    param: { id },
    json: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateGoal;
