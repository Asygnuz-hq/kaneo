import { z } from "../openapi";

export const avatarSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description:
        "Public URL for the stored avatar, served from /api/user/avatar/{id}.",
    }),
    size: z.number().openapi({ description: "Decoded size in bytes." }),
  })
  .openapi("UserAvatar");

export const avatarDeletedSchema = z
  .object({
    deleted: z.boolean().openapi({
      description: "False when the user had no uploaded avatar to remove.",
    }),
  })
  .openapi("UserAvatarDeleted");

export const scopedApiKeySchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    key: z.string().openapi({
      description: "The raw key value. Returned only once, at creation.",
    }),
    prefix: z.string().nullable(),
    start: z.string().nullable(),
    permissions: z.record(z.string(), z.array(z.string())).nullable(),
    expiresAt: z.union([z.string(), z.date()]).nullable(),
    createdAt: z.union([z.string(), z.date()]),
  })
  .openapi("ScopedApiKey");
