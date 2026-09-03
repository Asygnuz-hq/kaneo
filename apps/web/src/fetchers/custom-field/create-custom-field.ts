import { client } from "@kaneo/libs";

async function createCustomField({
  workspaceId,
  name,
  type,
  options,
}: {
  workspaceId: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "checkbox";
  options?: string[];
}) {
  const response = await client["custom-field"].$post({
    json: { workspaceId, name, type, options },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createCustomField;
