import { client } from "@kaneo/libs";

async function startSprint(id: string) {
  const response = await client.sprint[":id"].start.$put({ param: { id } });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default startSprint;
