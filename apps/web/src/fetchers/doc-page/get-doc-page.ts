import { client } from "@kaneo/libs";

async function getDocPage(id: string) {
  const response = await client["doc-page"][":id"].$get({ param: { id } });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getDocPage;
