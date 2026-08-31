import { eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function getClientAccountById(id: string) {
  const [account] = await db
    .select({
      id: schema.clientAccountTable.id,
      email: schema.clientAccountTable.email,
      name: schema.clientAccountTable.name,
    })
    .from(schema.clientAccountTable)
    .where(eq(schema.clientAccountTable.id, id))
    .limit(1);

  return account ?? null;
}

export default getClientAccountById;
