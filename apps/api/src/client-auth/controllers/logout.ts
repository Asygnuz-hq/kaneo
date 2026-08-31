import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { hashToken } from "../tokens";

async function logoutClient(token: string) {
  await db
    .delete(schema.clientSessionTable)
    .where(eq(schema.clientSessionTable.tokenHash, hashToken(token)));
}

export default logoutClient;
