import { client } from "@kaneo/libs";

async function inviteProjectClient({
  projectId,
  email,
  name,
}: {
  projectId: string;
  email: string;
  name?: string;
}) {
  const response = await client["client-access"][":projectId"].$post({
    param: { projectId },
    json: { email, name },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default inviteProjectClient;
