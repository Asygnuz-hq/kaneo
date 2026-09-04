import { client } from "@kaneo/libs";

async function deleteDocPage({ id }: { id: string }) {
  const response = await client["doc-page"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteDocPage;
