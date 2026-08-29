import { client } from "@kaneo/libs";

async function updateTaskSprint(id: string, sprintId: string | null) {
  const response = await client.task.sprint[":id"].$put({
    param: { id },
    json: { sprintId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateTaskSprint;
