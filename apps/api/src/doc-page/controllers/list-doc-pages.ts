import { asc, eq } from "drizzle-orm";
import db, { schema } from "../../database";

// Flat list, ordered by position -- the frontend groups by parentId to build
// the tree. No `content` here (see response.ts's docPageListItemSchema):
// a project's whole wiki can be many pages, and content bodies can be long,
// so the sidebar/tree view only needs title + hierarchy, not every body.
async function listDocPages(projectId: string) {
  return db
    .select({
      id: schema.docPageTable.id,
      projectId: schema.docPageTable.projectId,
      parentId: schema.docPageTable.parentId,
      title: schema.docPageTable.title,
      position: schema.docPageTable.position,
      createdByUserId: schema.docPageTable.createdByUserId,
      updatedByUserId: schema.docPageTable.updatedByUserId,
      createdAt: schema.docPageTable.createdAt,
      updatedAt: schema.docPageTable.updatedAt,
    })
    .from(schema.docPageTable)
    .where(eq(schema.docPageTable.projectId, projectId))
    .orderBy(asc(schema.docPageTable.position));
}

export default listDocPages;
