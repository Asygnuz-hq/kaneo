import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

// Cascades to every task_external_assignee row for this contact
// (onDelete: "cascade" in schema.ts) -- every task it was marked on simply
// loses that badge, there's no undo.
async function deleteExternalContact(id: string) {
  const [deleted] = await db
    .delete(schema.externalContactTable)
    .where(eq(schema.externalContactTable.id, id))
    .returning({ id: schema.externalContactTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "External contact not found" });
  }

  return deleted;
}

export default deleteExternalContact;
