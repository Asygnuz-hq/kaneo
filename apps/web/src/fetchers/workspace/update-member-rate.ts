import { client } from "@kaneo/libs";

async function updateMemberRate({
  workspaceId,
  userId,
  hourlyRateCents,
  billRateCents,
}: {
  workspaceId: string;
  userId: string;
  hourlyRateCents?: number | null;
  billRateCents?: number | null;
}) {
  const response = await client.workspace[":workspaceId"].members[
    ":userId"
  ].rate.$put({
    param: { workspaceId, userId },
    json: { hourlyRateCents, billRateCents },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateMemberRate;
