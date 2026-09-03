import { client } from "@kaneo/libs";

async function updateDocPage({
  id,
  title,
  content,
  parentId,
  position,
}: {
  id: string;
  title?: string;
  content?: string;
  parentId?: string | null;
  position?: number;
}) {
  const response = await client["doc-page"][":id"].$put({
    param: { id },
    json: { title, content, parentId, position },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateDocPage;
