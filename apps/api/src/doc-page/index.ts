import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createDocPage from "./controllers/create-doc-page";
import deleteDocPage from "./controllers/delete-doc-page";
import getDocPage from "./controllers/get-doc-page";
import listDocPages from "./controllers/list-doc-pages";
import updateDocPage from "./controllers/update-doc-page";
import {
  docPageListSchema,
  docPageSchema,
  removedDocPageSchema,
} from "./response";
import {
  createDocPageBody,
  docPageIdParam,
  projectIdParam,
  updateDocPageBody,
} from "./schema";

// ASYGNUZ: Docs/Wiki integrado -- a lightweight per-project wiki, pages
// nested in a tree via parentId. See database/schema.ts's comment on
// docPageTable for the shape and deletion semantics.

const listDocPagesRoute = createRoute({
  method: "get",
  operationId: "listDocPages",
  path: "/project/{projectId}",
  tags: ["Docs"],
  summary: "List a project's doc pages",
  description:
    "List every page in a project's wiki, flat and ordered by position, without content -- the frontend builds the tree from parentId and fetches a page's content only when it's opened.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Doc pages in the project", docPageListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const getDocPageRoute = createRoute({
  method: "get",
  operationId: "getDocPage",
  path: "/{id}",
  tags: ["Docs"],
  summary: "Get a doc page",
  description: "Get a single doc page, including its full content.",
  middleware: [workspaceAccess.fromDocPage()] as const,
  request: { params: docPageIdParam },
  responses: {
    200: jsonResponse("The doc page", docPageSchema),
    400: errorResponse(
      "Unknown doc page, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the page's workspace"),
    404: errorResponse("Doc page not found"),
  },
});

const createDocPageRoute = createRoute({
  method: "post",
  operationId: "createDocPage",
  path: "/",
  tags: ["Docs"],
  summary: "Create a doc page",
  description:
    "Create a new wiki page in a project, optionally nested under an existing page.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createDocPageBody } },
    },
  },
  responses: {
    200: jsonResponse("The created doc page", docPageSchema),
    400: errorResponse("Invalid body, unknown parent page, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateDocPageRoute = createRoute({
  method: "put",
  operationId: "updateDocPage",
  path: "/{id}",
  tags: ["Docs"],
  summary: "Update a doc page",
  description:
    "Rename a page, edit its content, or move it -- reparent it under another page in the same project (or to the root with parentId: null) and/or reorder it among its siblings.",
  middleware: [
    workspaceAccess.fromDocPage(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: docPageIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateDocPageBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated doc page", docPageSchema),
    400: errorResponse(
      "Invalid body, a parent from another project, or a move that would create a cycle",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Doc page not found"),
  },
});

const deleteDocPageRoute = createRoute({
  method: "delete",
  operationId: "deleteDocPage",
  path: "/{id}",
  tags: ["Docs"],
  summary: "Delete a doc page",
  description:
    "Delete a doc page. Its children are promoted to the root of the project's tree rather than deleted with it.",
  middleware: [
    workspaceAccess.fromDocPage(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: docPageIdParam },
  responses: {
    200: jsonResponse("Doc page deleted", removedDocPageSchema),
    400: errorResponse(
      "Unknown doc page, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Doc page not found"),
  },
});

const docPage = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listDocPagesRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await listDocPages(projectId), 200);
  })
  .openapi(getDocPageRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getDocPage(id), 200);
  })
  .openapi(createDocPageRoute, async (c) => {
    const { projectId, title, content, parentId } = c.req.valid("json");
    return c.json(
      await createDocPage(projectId, title, content, parentId, c.get("userId")),
      200,
    );
  })
  .openapi(updateDocPageRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { title, content, parentId, position } = c.req.valid("json");
    return c.json(
      await updateDocPage(
        id,
        { title, content, parentId, position },
        c.get("userId"),
      ),
      200,
    );
  })
  .openapi(deleteDocPageRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await deleteDocPage(id), 200);
  });

export default docPage;
