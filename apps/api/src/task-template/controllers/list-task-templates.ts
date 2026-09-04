import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { taskTemplateTable } from "../../database/schema";
import { serializeTaskTemplate } from "../serialize";

async function listTaskTemplates(projectId: string) {
  const rows = await db
    .select()
    .from(taskTemplateTable)
    .where(eq(taskTemplateTable.projectId, projectId))
    .orderBy(asc(taskTemplateTable.position));

  return rows.map(serializeTaskTemplate);
}

export default listTaskTemplates;
