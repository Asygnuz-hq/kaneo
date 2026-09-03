import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

async function getDocPage(id: string) {
  const [page] = await db
    .select()
    .from(schema.docPageTable)
    .where(eq(schema.docPageTable.id, id))
    .limit(1);

  if (!page) {
    throw new HTTPException(404, { message: "Doc page not found" });
  }

  return page;
}

export default getDocPage;
