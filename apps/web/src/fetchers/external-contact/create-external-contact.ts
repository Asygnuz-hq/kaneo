import { client } from "@kaneo/libs";

async function createExternalContact({
  workspaceId,
  name,
}: {
  workspaceId: string;
  name: string;
}) {
  const response = await client["external-contact"].$post({
    json: { workspaceId, name },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createExternalContact;
