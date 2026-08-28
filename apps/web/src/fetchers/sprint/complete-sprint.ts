import { client } from "@kaneo/libs";

async function completeSprint(id: string) {
  const response = await client.sprint[":id"].complete.$put({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default completeSprint;
