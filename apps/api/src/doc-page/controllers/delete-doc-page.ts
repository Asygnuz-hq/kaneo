import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

// Children are promoted to root (parentId set to null) rather than deleted
// along with their parent -- see the comment on docPageTable in
// database/schema.ts for why.
async function deleteDocPage(id: string) {
  const [deleted] = await db
    .delete(schema.docPageTable)
    .where(eq(schema.docPageTable.id, id))
    .returning({ id: schema.docPageTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "Doc page not found" });
  }

  return deleted;
}

export default deleteDocPage;
