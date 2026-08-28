import { eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function listClientProjects(clientAccountId: string) {
  return db
    .select({
      id: schema.projectTable.id,
      name: schema.projectTable.name,
      slug: schema.projectTable.slug,
      icon: schema.projectTable.icon,
    })
    .from(schema.clientProjectAccessTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.clientProjectAccessTable.projectId, schema.projectTable.id),
    )
    .where(
      eq(schema.clientProjectAccessTable.clientAccountId, clientAccountId),
    );
}

export default listClientProjects;
