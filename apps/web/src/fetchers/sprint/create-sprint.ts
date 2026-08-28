import { client } from "@kaneo/libs";

async function createSprint({
  projectId,
  name,
  goal,
  startDate,
  endDate,
}: {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}) {
  const response = await client.sprint.$post({
    json: { projectId, name, goal, startDate, endDate },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createSprint;
