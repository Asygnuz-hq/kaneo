import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

async function removeProjectClient(projectId: string, clientAccountId: string) {
  const [deleted] = await db
    .delete(schema.clientProjectAccessTable)
    .where(
      and(
        eq(schema.clientProjectAccessTable.projectId, projectId),
        eq(schema.clientProjectAccessTable.clientAccountId, clientAccountId),
      ),
    )
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Client access not found" });
  }

  return { projectId, clientAccountId };
}

export default removeProjectClient;
