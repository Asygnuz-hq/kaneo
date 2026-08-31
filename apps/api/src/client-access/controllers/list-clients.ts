import { eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function listProjectClients(projectId: string) {
  const rows = await db
    .select({
      id: schema.clientProjectAccessTable.id,
      clientAccountId: schema.clientAccountTable.id,
      email: schema.clientAccountTable.email,
      name: schema.clientAccountTable.name,
      passwordHash: schema.clientAccountTable.passwordHash,
      createdAt: schema.clientProjectAccessTable.createdAt,
    })
    .from(schema.clientProjectAccessTable)
    .innerJoin(
      schema.clientAccountTable,
      eq(
        schema.clientProjectAccessTable.clientAccountId,
        schema.clientAccountTable.id,
      ),
    )
    .where(eq(schema.clientProjectAccessTable.projectId, projectId));

  return rows.map((row) => ({
    id: row.id,
    clientAccountId: row.clientAccountId,
    email: row.email,
    name: row.name,
    status: (row.passwordHash ? "active" : "pending") as "active" | "pending",
    createdAt: row.createdAt,
  }));
}

export default listProjectClients;
