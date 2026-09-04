import { client } from "@kaneo/libs";

async function deleteGoal(id: string) {
  const response = await client.goal[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteGoal;
