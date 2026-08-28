import { client } from "@kaneo/libs";

async function updateSprint(
  id: string,
  fields: {
    name?: string;
    goal?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
) {
  const response = await client.sprint[":id"].$put({
    param: { id },
    json: fields,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateSprint;
