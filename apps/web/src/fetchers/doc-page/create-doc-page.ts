import { client } from "@kaneo/libs";

async function createDocPage({
  projectId,
  parentId,
  title,
  content,
}: {
  projectId: string;
  parentId?: string | null;
  title: string;
  content?: string;
}) {
  const response = await client["doc-page"].$post({
    json: { projectId, parentId, title, content },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createDocPage;
