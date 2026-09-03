import { client } from "@kaneo/libs";

async function deleteTaskTemplate(id: string) {
  const response = await client["task-template"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteTaskTemplate;
