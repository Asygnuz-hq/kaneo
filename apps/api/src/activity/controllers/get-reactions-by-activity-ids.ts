import { inArray } from "drizzle-orm";
import db from "../../database";
import { activityReactionTable } from "../../database/schema";

export type ActivityReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

// ASYGNUZ: agrega en memoria en vez de un GROUP BY -- necesitamos, por cada
// (activity, emoji), tanto el conteo como si el usuario actual está entre
// los que reaccionaron, y eso último no sale gratis de un GROUP BY simple.
// El volumen esperado (reacciones por tarea) hace este trade-off razonable.
async function getReactionsByActivityIds(
  activityIds: string[],
  currentUserId: string | null,
): Promise<Map<string, ActivityReactionSummary[]>> {
  const result = new Map<string, ActivityReactionSummary[]>();
  if (activityIds.length === 0) return result;

  const rows = await db
    .select({
      activityId: activityReactionTable.activityId,
      emoji: activityReactionTable.emoji,
      userId: activityReactionTable.userId,
    })
    .from(activityReactionTable)
    .where(inArray(activityReactionTable.activityId, activityIds));

  const byActivity = new Map<string, Map<string, ActivityReactionSummary>>();
  for (const row of rows) {
    let byEmoji = byActivity.get(row.activityId);
    if (!byEmoji) {
      byEmoji = new Map();
      byActivity.set(row.activityId, byEmoji);
    }
    const existing = byEmoji.get(row.emoji);
    if (existing) {
      existing.count += 1;
      if (row.userId === currentUserId) existing.reactedByMe = true;
    } else {
      byEmoji.set(row.emoji, {
        emoji: row.emoji,
        count: 1,
        reactedByMe: row.userId === currentUserId,
      });
    }
  }

  for (const [activityId, byEmoji] of byActivity) {
    result.set(activityId, Array.from(byEmoji.values()));
  }

  return result;
}

export default getReactionsByActivityIds;
