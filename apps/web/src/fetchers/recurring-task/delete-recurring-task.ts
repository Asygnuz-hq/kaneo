import { client } from "@kaneo/libs";

async function deleteRecurringTask(id: string) {
  const response = await client["recurring-task"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteRecurringTask;
