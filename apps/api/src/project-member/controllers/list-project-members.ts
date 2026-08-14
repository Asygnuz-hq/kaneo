import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { projectMemberTable } from "../../database/schema";

async function listProjectMembers(projectId: string) {
  return db
    .select({
      id: projectMemberTable.id,
      userId: projectMemberTable.userId,
      name: schema.userTable.name,
      email: schema.userTable.email,
      createdAt: projectMemberTable.createdAt,
    })
    .from(projectMemberTable)
    .innerJoin(
      schema.userTable,
      eq(schema.userTable.id, projectMemberTable.userId),
    )
    .where(eq(projectMemberTable.projectId, projectId));
}

export default listProjectMembers;
