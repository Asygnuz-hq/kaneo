import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";
import getReactionsByActivityIds from "./get-reactions-by-activity-ids";

async function getActivitiesFromTaskId(
  taskId: string,
  currentUserId: string | null,
) {
  const activities = await db.query.activityTable.findMany({
    where: eq(activityTable.taskId, taskId),
    orderBy: [desc(activityTable.createdAt)],
  });

  activities.forEach((x) => {
    if (x.content) {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  const commentIds = activities
    .filter((activity) => activity.type === "comment")
    .map((activity) => activity.id);
  const reactionsByActivityId = await getReactionsByActivityIds(
    commentIds,
    currentUserId,
  );

  return activities.map((activity) => ({
    ...activity,
    reactions: reactionsByActivityId.get(activity.id) ?? [],
  }));
}

export default getActivitiesFromTaskId;
