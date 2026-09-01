import { desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";

// ASYGNUZ: solo lo que ESE cliente envió -- nunca los tickets de otro
// cliente del mismo proyecto, aunque comparta acceso al proyecto.
async function listTickets(clientAccountId: string) {
  return db
    .select({
      id: schema.taskTable.id,
      number: schema.taskTable.number,
      title: schema.taskTable.title,
      status: schema.taskTable.status,
      createdAt: schema.taskTable.createdAt,
      projectId: schema.taskTable.projectId,
      projectName: schema.projectTable.name,
      projectSlug: schema.projectTable.slug,
    })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.taskTable.projectId, schema.projectTable.id),
    )
    .where(eq(schema.taskTable.requestedByClientId, clientAccountId))
    .orderBy(desc(schema.taskTable.createdAt));
}

export default listTickets;
