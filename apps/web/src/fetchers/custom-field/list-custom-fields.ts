import { client } from "@kaneo/libs";

async function listCustomFields(workspaceId: string) {
  const response = await client["custom-field"].workspace[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listCustomFields;
