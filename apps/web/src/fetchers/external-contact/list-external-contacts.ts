import { client } from "@kaneo/libs";

async function listExternalContacts(workspaceId: string) {
  const response = await client["external-contact"].workspace[
    ":workspaceId"
  ].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listExternalContacts;
