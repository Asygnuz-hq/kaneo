import { eq } from "drizzle-orm";
import db from "../../database";
import { activityReactionTable } from "../../database/schema";
import getReactionsByActivityIds from "./get-reactions-by-activity-ids";

// Toggle semantics: reacting again with the same emoji removes it. Simpler
// for the client than separate add/remove endpoints, and matches how every
// mainstream chat/PM tool's emoji-reaction button behaves.
async function toggleReaction(
  userId: string,
  activityId: string,
  emoji: string,
) {
  const existing = await db.query.activityReactionTable.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.activityId, activityId),
        eq(table.userId, userId),
        eq(table.emoji, emoji),
      ),
  });

  if (existing) {
    await db
      .delete(activityReactionTable)
      .where(eq(activityReactionTable.id, existing.id));
  } else {
    await db.insert(activityReactionTable).values({
      activityId,
      userId,
      emoji,
    });
  }

  const reactionsByActivityId = await getReactionsByActivityIds(
    [activityId],
    userId,
  );

  return reactionsByActivityId.get(activityId) ?? [];
}

export default toggleReaction;
