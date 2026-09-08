import type createScopedApiKey from "@/fetchers/user/create-scoped-api-key";
import type { authClient } from "@/lib/auth-client";

export type ApiKey = NonNullable<
  Awaited<ReturnType<typeof authClient.apiKey.list>>["data"]
>;

export type CreateApiKeyClientRequest = {
  name: string;
  expiresIn: number | null;
  /**
   * Narrows what this key can do, e.g. { task: ["read", "update"] }.
   * Omit for a key with no extra restriction beyond the creator's own
   * workspace role, which is always enforced regardless of this field.
   */
  permissions?: Record<string, string[]>;
};

export type CreateApiKeyResponse = Awaited<
  ReturnType<typeof createScopedApiKey>
>;
