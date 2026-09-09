import { APIError } from "better-auth/api";
import { HTTPException } from "hono/http-exception";
import { auth } from "../../auth";

// Creating a key with a narrowed `permissions` scope is a server-only
// property on better-auth's api-key plugin -- passing it through the public
// client SDK throws SERVER_ONLY_PROPERTY. Calling auth.api.createApiKey
// without a `headers` key (see utils/migrate-organizations.ts for the same
// pattern) runs it as a privileged, non-client request, which is what
// unlocks `permissions` and `userId`. The live request-time check in
// require-workspace-permission.ts ANDs a key's stored scope with the
// caller's actual workspace role, so a key can never grant more than the
// user who created it already has -- there's nothing to escalate here even
// if the caller requests a broader scope than they need.
async function createScopedApiKey({
  userId,
  name,
  expiresIn,
  permissions,
}: {
  userId: string;
  name: string;
  expiresIn: number | null;
  permissions?: Record<string, string[]>;
}) {
  let created: Awaited<ReturnType<typeof auth.api.createApiKey>>;
  try {
    created = await auth.api.createApiKey({
      body: {
        userId,
        name,
        expiresIn,
        permissions,
      },
    });
  } catch (error) {
    // better-auth validates expiresIn/permissions itself (e.g. "expiresIn
    // is smaller than the predefined minimum value") and throws an APIError
    // -- a normal 4xx, not a server failure. Left uncaught, it fell through
    // to the app's generic onError handler, which turns any non-HTTPException
    // into an opaque 500, hiding a message the caller could actually act on.
    if (error instanceof APIError) {
      // better-auth's api-key plugin only ever rejects createApiKey's own
      // input this way (bad expiresIn, malformed permissions, ...) -- there
      // is no case where it throws a non-400 APIError from this call.
      throw new HTTPException(400, {
        message: error.body?.message ?? error.message,
      });
    }
    throw error;
  }

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create API key" });
  }

  return created;
}

export default createScopedApiKey;
