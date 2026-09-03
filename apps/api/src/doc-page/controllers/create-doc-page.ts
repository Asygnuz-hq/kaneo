import { createId } from "@paralleldrive/cuid2";
import { and, count, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { assertParentInSameProject } from "../validate-doc-page";

async function createDocPage(
  projectId: string,
  title: string,
  content: string | undefined,
  parentId: string | null | undefined,
  currentUserId: string,
) {
  if (parentId) {
    await assertParentInSameProject(parentId, projectId);
  }

  const [countRow] = await db
    .select({ value: count() })
    .from(schema.docPageTable)
    .where(
      and(
        eq(schema.docPageTable.projectId, projectId),
        parentId
          ? eq(schema.docPageTable.parentId, parentId)
          : isNull(schema.docPageTable.parentId),
      ),
    );
  const siblingCount = countRow?.value ?? 0;

  const [created] = await db
    .insert(schema.docPageTable)
    .values({
      id: createId(),
      projectId,
      parentId: parentId ?? null,
      title,
      content: content ?? "",
      position: siblingCount,
      createdByUserId: currentUserId,
      updatedByUserId: currentUserId,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create doc page" });
  }

  return created;
}

export default createDocPage;
