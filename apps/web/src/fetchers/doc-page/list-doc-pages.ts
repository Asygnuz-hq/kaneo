import { client } from "@kaneo/libs";

async function listDocPages(projectId: string) {
  const response = await client["doc-page"].project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listDocPages;
