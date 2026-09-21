import { createHmac, timingSafeEqual } from "node:crypto";

// Mirrors the scheme Kaneo's own Generic Webhook plugin uses when sending
// events out (plugins/generic-webhook/client.ts): hex(hmac_sha256(secret, rawBody))
// in an X-Kaneo-Signature header.
export function verifyMirrorSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signatureHeader, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
