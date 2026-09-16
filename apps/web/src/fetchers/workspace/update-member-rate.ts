import { client } from "@kaneo/libs";

async function updateMemberRate({
  workspaceId,
  userId,
  hourlyRateCents,
}: {
  workspaceId: string;
  userId: string;
  hourlyRateCents: number | null;
}) {
  const response = await client.workspace[":workspaceId"].members[
    ":userId"
  ].rate.$put({
    param: { workspaceId, userId },
    json: { hourlyRateCents },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateMemberRate;
