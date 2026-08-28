import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { sprintTable } from "../../database/schema";

async function listSprints(projectId: string) {
  return db
    .select()
    .from(sprintTable)
    .where(eq(sprintTable.projectId, projectId))
    .orderBy(asc(sprintTable.position));
}

export default listSprints;
