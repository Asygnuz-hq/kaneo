import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

async function createExternalContact(workspaceId: string, name: string) {
  const [existing] = await db
    .select({ id: schema.externalContactTable.id })
    .from(schema.externalContactTable)
    .where(
      and(
        eq(schema.externalContactTable.workspaceId, workspaceId),
        eq(schema.externalContactTable.name, name),
      ),
    )
    .limit(1);
  if (existing) {
    throw new HTTPException(400, {
      message: `Ya existe un contacto externo llamado "${name}" en este workspace`,
    });
  }

  const [created] = await db
    .insert(schema.externalContactTable)
    .values({ id: createId(), workspaceId, name })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create external contact",
    });
  }

  return created;
}

export default createExternalContact;
