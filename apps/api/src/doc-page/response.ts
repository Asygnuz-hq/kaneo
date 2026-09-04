import { responseTimestamp, z } from "../openapi";

// ASYGNUZ: Docs/Wiki -- a per-project tree of pages. The list endpoint
// returns every page flat (id + parentId + title + position, no content) so
// the frontend can build the tree client-side and only fetch a page's full
// `content` when it's actually opened -- see controllers/list-doc-pages.ts.

export const docPageSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    parentId: z.string().nullable(),
    title: z.string(),
    content: z.string(),
    position: z.number(),
    createdByUserId: z.string().nullable(),
    updatedByUserId: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("DocPage");

export const docPageListItemSchema = docPageSchema.omit({ content: true });

export const docPageListSchema = z.array(docPageListItemSchema);

export const removedDocPageSchema = z
  .object({ id: z.string() })
  .openapi("RemovedDocPage");
