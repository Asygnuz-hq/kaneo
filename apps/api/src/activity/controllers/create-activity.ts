import db from "../../database";
import { activityTable } from "../../database/schema";

async function createActivity(
  taskId: string,
  type: string,
  userId: string,
  content: string | null,
  eventData?: Record<string, unknown> | null,
) {
  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type,
      // The mirror acts with no user of its own (""); a blank id would break
      // the foreign key and silently drop the history row.
      userId: userId || null,
      content,
      eventData: eventData ?? null,
    })
    .returning();
  return activity;
}

export default createActivity;
