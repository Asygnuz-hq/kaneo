import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { MAX_AVATAR_BYTES } from "./avatar";
import createScopedApiKey from "./controllers/create-scoped-api-key";
import deleteAvatar from "./controllers/delete-avatar";
import saveAvatar from "./controllers/save-avatar";
import {
  avatarDeletedSchema,
  avatarSchema,
  scopedApiKeySchema,
} from "./response";
import { createScopedApiKeyBody, uploadAvatarBody } from "./schema";

const uploadAvatarRoute = createRoute({
  method: "put",
  operationId: "uploadUserAvatar",
  path: "/avatar",
  tags: ["User"],
  summary: "Upload avatar",
  description: `Store a base64 encoded avatar (PNG, JPEG, or WebP, up to ${Math.floor(
    MAX_AVATAR_BYTES / 1024,
  )}KB) for the current user and return its public URL. Replaces any existing avatar.`,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: uploadAvatarBody } },
    },
  },
  responses: {
    200: jsonResponse("Avatar stored", avatarSchema),
    400: errorResponse(
      "Unsupported content type, malformed base64, or too large",
    ),
  },
});

const deleteAvatarRoute = createRoute({
  method: "delete",
  operationId: "deleteUserAvatar",
  path: "/avatar",
  tags: ["User"],
  summary: "Delete avatar",
  description:
    "Remove the uploaded avatar of the current user. Succeeds even when there was nothing to remove.",
  responses: {
    200: jsonResponse("Avatar removed", avatarDeletedSchema),
  },
});

const createScopedApiKeyRoute = createRoute({
  method: "post",
  operationId: "createScopedApiKey",
  path: "/api-key",
  tags: ["User"],
  summary: "Create an API key with a narrowed permission scope",
  description:
    "Like the generic Better Auth API key creation, but lets you also set `permissions` to narrow what this specific key can do (e.g. only read/update tasks) -- useful for handing a key to an external integration without giving it full account access. A key can never exceed the workspace role of the user who created it, regardless of what permissions are requested here; this only narrows further. The raw key is returned once, in this response, and never again.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createScopedApiKeyBody } },
    },
  },
  responses: {
    200: jsonResponse("The created API key", scopedApiKeySchema),
    400: errorResponse("Invalid body"),
  },
});

const user = apiRouter()
  .openapi(createScopedApiKeyRoute, async (c) => {
    const { name, expiresIn, permissions } = c.req.valid("json");
    const created = await createScopedApiKey({
      userId: c.get("userId"),
      name,
      expiresIn,
      permissions,
    });
    return c.json(created, 200);
  })
  .openapi(uploadAvatarRoute, async (c) => {
    const { contentType, data } = c.req.valid("json");
    try {
      return c.json(
        await saveAvatar({ userId: c.get("userId"), contentType, data }),
        200,
      );
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error ? error.message : "Invalid avatar upload",
      });
    }
  })
  .openapi(deleteAvatarRoute, async (c) =>
    c.json(await deleteAvatar(c.get("userId")), 200),
  );

export default user;
