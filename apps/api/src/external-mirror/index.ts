import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { runWebhookBackfill } from "../plugins/generic-webhook/events";
import { readAssetForMirror, verifyAssetSignature } from "./assets";
import { isMirrorEnabled, mirrorSecret } from "./config";
import { handleMirrorEvent } from "./controllers/handle-mirror-event";
import { mirrorWebhookResultSchema } from "./response";
import { mirrorTaskPayloadSchema } from "./schema";
import { verifyMirrorSignature } from "./verify-signature";

// Excluded from the app-wide auth middleware (see index.ts): the caller is
// another Kaneo instance's Generic Webhook plugin, not a logged-in user, so
// authenticity comes from the X-Kaneo-Signature HMAC header instead of a
// session -- same model as billing/index.ts's provider webhook.
// Instance-specific (Asygnuz <- Financieramente only), so kept out of the
// published OpenAPI document.
const webhookRoute = createRoute({
  hide: true,
  method: "post",
  operationId: "handleExternalMirrorWebhook",
  path: "/financieramente",
  tags: ["External Mirror"],
  summary: "Financieramente task mirror webhook",
  description:
    "Receive Generic Webhook task events from kaneo-mia's Tecnología project and mirror them onto the matching local task in the Financieramente tracking project. Authenticated by HMAC signature, not by session.",
  security: [],
  responses: {
    200: jsonResponse("The event was processed", mirrorWebhookResultSchema),
    400: errorResponse("Signature verification failed, or invalid payload"),
    404: errorResponse("The mirror integration is not configured"),
  },
});

const externalMirror = apiRouter<BaseVariables>()
  .openapi(webhookRoute, async (c) => {
    if (!isMirrorEnabled()) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const rawBody = await c.req.text();
    if (
      !verifyMirrorSignature(
        rawBody,
        c.req.header("X-Kaneo-Signature"),
        mirrorSecret(),
      )
    ) {
      throw new HTTPException(400, { message: "Invalid signature" });
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new HTTPException(400, { message: "Invalid JSON body" });
    }

    const parsed = mirrorTaskPayloadSchema.safeParse(json);
    if (!parsed.success) {
      throw new HTTPException(400, { message: "Invalid payload" });
    }

    try {
      await handleMirrorEvent(parsed.data);
    } catch (error) {
      console.error("external-mirror: failed to process event", error);
      throw new HTTPException(500, { message: "Failed to process event" });
    }

    return c.json({ received: true }, 200);
  })
  .post("/backfill", async (c) => {
    // Sender-side only: it needs the shared secret, not the target project.
    if (!mirrorSecret()) {
      throw new HTTPException(404, { message: "Not found" });
    }
    const rawBody = await c.req.text();
    if (
      !verifyMirrorSignature(
        rawBody,
        c.req.header("X-Kaneo-Signature"),
        mirrorSecret(),
      )
    ) {
      throw new HTTPException(400, { message: "Invalid signature" });
    }
    const result = await runWebhookBackfill();
    return c.json(result, 202);
  })
  .get("/asset/:id", async (c) => {
    if (!isMirrorEnabled()) {
      throw new HTTPException(404, { message: "Not found" });
    }
    const id = c.req.param("id");
    if (!verifyAssetSignature(id, c.req.header("X-Kaneo-Signature"))) {
      throw new HTTPException(400, { message: "Invalid signature" });
    }
    const asset = await readAssetForMirror(id);
    if (!asset) {
      throw new HTTPException(404, { message: "Asset not found" });
    }
    return new Response(asset.body, {
      headers: {
        "Content-Type": asset.mimeType,
        "X-Kaneo-Filename": encodeURIComponent(asset.filename),
      },
    });
  });

export default externalMirror;
