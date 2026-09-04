import { asc, eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function listExternalContacts(workspaceId: string) {
  return db
    .select()
    .from(schema.externalContactTable)
    .where(eq(schema.externalContactTable.workspaceId, workspaceId))
    .orderBy(asc(schema.externalContactTable.name));
}

export default listExternalContacts;
