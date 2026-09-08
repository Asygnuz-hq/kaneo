import { z } from "../openapi";

export const uploadAvatarBody = z.object({
  contentType: z.string().openapi({
    description: "One of image/png, image/jpeg, or image/webp.",
    example: "image/png",
  }),
  data: z.string().openapi({ description: "Base64 encoded image bytes." }),
});

export const createScopedApiKeyBody = z.object({
  name: z.string().min(1),
  expiresIn: z.number().int().positive().nullable().openapi({
    description:
      "Seconds until expiration, or null for a key that never expires.",
  }),
  permissions: z.record(z.string(), z.array(z.string())).optional().openapi({
    description:
      'Narrows what this key can do, e.g. { task: ["read", "update"] }. The key can never do more than the workspace role of the user who created it already allows -- this only narrows further. Omit for a key with no extra restriction.',
  }),
});
