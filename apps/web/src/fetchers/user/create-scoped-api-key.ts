import { client } from "@kaneo/libs";

async function createScopedApiKey({
  name,
  expiresIn,
  permissions,
}: {
  name: string;
  expiresIn: number | null;
  permissions?: Record<string, string[]>;
}) {
  const response = await client.user["api-key"].$post({
    json: { name, expiresIn, permissions },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createScopedApiKey;
