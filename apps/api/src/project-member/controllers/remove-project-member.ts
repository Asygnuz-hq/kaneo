import { and, eq } from "drizzle-orm";
import db from "../../database";
import { projectMemberTable } from "../../database/schema";

async function removeProjectMember(projectId: string, userId: string) {
  await db
    .delete(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, userId),
      ),
    );
  return { projectId, userId };
}

export default removeProjectMember;
