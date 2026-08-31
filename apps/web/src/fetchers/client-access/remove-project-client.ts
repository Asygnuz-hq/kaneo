import { client } from "@kaneo/libs";

async function removeProjectClient({
  projectId,
  clientAccountId,
}: {
  projectId: string;
  clientAccountId: string;
}) {
  const response = await client["client-access"][":projectId"][
    ":clientAccountId"
  ].$delete({
    param: { projectId, clientAccountId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default removeProjectClient;
