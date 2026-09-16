import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function updateMemberRate({
  workspaceId,
  userId,
  hourlyRateCents,
}: {
  workspaceId: string;
  userId: string;
  hourlyRateCents: number | null;
}) {
  const [updatedMember] = await db
    .update(workspaceUserTable)
    .set({ hourlyRateCents })
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .returning();

  if (!updatedMember) {
    throw new HTTPException(404, {
      message: "That user isn't a member of this workspace",
    });
  }

  return updatedMember;
}

export default updateMemberRate;
