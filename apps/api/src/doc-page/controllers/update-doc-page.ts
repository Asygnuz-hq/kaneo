import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { assertNoCycle, assertParentInSameProject } from "../validate-doc-page";

async function updateDocPage(
  id: string,
  updates: {
    title?: string;
    content?: string;
    parentId?: string | null;
    position?: number;
  },
  currentUserId: string,
) {
  const [page] = await db
    .select()
    .from(schema.docPageTable)
    .where(eq(schema.docPageTable.id, id))
    .limit(1);
  if (!page) {
    throw new HTTPException(404, { message: "Doc page not found" });
  }

  if (updates.parentId !== undefined && updates.parentId !== null) {
    if (updates.parentId === id) {
      throw new HTTPException(400, {
        message: "A page cannot be its own parent",
      });
    }
    await assertParentInSameProject(updates.parentId, page.projectId);
    await assertNoCycle(id, updates.parentId);
  }

  const [updated] = await db
    .update(schema.docPageTable)
    .set({
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.content !== undefined ? { content: updates.content } : {}),
      ...(updates.parentId !== undefined ? { parentId: updates.parentId } : {}),
      ...(updates.position !== undefined ? { position: updates.position } : {}),
      updatedByUserId: currentUserId,
    })
    .where(eq(schema.docPageTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update doc page" });
  }

  return updated;
}

export default updateDocPage;
