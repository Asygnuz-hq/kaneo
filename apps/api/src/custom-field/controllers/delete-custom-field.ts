import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

// Deleting a field cascades to every task_custom_field_value row for it
// (onDelete: "cascade" in schema.ts) -- every task silently loses whatever
// it had entered for this field, there's no undo.
async function deleteCustomField(id: string) {
  const [deleted] = await db
    .delete(schema.customFieldTable)
    .where(eq(schema.customFieldTable.id, id))
    .returning({ id: schema.customFieldTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "Custom field not found" });
  }

  return deleted;
}

export default deleteCustomField;
