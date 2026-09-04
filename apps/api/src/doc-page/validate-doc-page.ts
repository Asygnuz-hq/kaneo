import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";

// A page's parent (when set) must live in the same project -- otherwise a
// project's wiki tree could reach into another project's pages, which the
// project-scoped access check on the parent side wouldn't catch.
export async function assertParentInSameProject(
  parentId: string,
  projectId: string,
): Promise<void> {
  const [parent] = await db
    .select({ projectId: schema.docPageTable.projectId })
    .from(schema.docPageTable)
    .where(eq(schema.docPageTable.id, parentId))
    .limit(1);

  if (!parent) {
    throw new HTTPException(400, { message: "Parent page not found" });
  }
  if (parent.projectId !== projectId) {
    throw new HTTPException(400, {
      message: "Parent page must belong to the same project",
    });
  }
}

// Walks up from `candidateParentId` toward the root, rejecting the move if
// `pageId` shows up along the way -- that would nest a page under one of its
// own descendants (or itself), turning the tree into a cycle. `visited`
// guards against looping forever if the data is somehow already corrupt.
export async function assertNoCycle(
  pageId: string,
  candidateParentId: string,
): Promise<void> {
  let currentId: string | null = candidateParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === pageId) {
      throw new HTTPException(400, {
        message:
          "A page cannot be moved under itself or one of its own descendants",
      });
    }
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const [row] = await db
      .select({ parentId: schema.docPageTable.parentId })
      .from(schema.docPageTable)
      .where(eq(schema.docPageTable.id, currentId))
      .limit(1);
    currentId = row?.parentId ?? null;
  }
}
