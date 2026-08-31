import { createHash, randomBytes } from "node:crypto";

// ASYGNUZ: opaque bearer tokens for the Service Desk client portal (invite
// links and session cookies both use these). Only the SHA-256 hash is ever
// stored -- the raw token exists only in the email link / the cookie, same
// reasoning as better-auth's own session.token handling.

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
