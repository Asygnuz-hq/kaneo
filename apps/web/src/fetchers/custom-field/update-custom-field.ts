import { client } from "@kaneo/libs";

async function updateCustomField({
  id,
  name,
  options,
}: {
  id: string;
  name: string;
  options?: string[];
}) {
  const response = await client["custom-field"][":id"].$put({
    param: { id },
    json: { name, options },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateCustomField;
