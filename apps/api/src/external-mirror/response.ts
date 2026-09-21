import { z } from "../openapi";

export const mirrorWebhookResultSchema = z
  .object({ received: z.boolean() })
  .openapi("ExternalMirrorWebhookResult");
