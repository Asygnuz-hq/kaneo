import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

// ASYGNUZ: /client-auth/login has no CSRF token or MFA behind it -- just an
// email + a password the client chose themselves, which can be weak. It
// also sits completely outside better-auth's own rate limiting (that only
// covers the internal app's auth routes, see auth.ts). Without this, the
// endpoint is open to unlimited password-guessing against any client
// account. In-memory is fine here: worst case on a multi-instance
// deployment is the limit being ~N× looser, never bypassed entirely, and
// this app has no Redis-backed shared state to lean on outside the
// broadcast adapter.
//
// Two independent buckets, both must clear: per-email (the direct
// brute-force vector against one account) and per-IP (one source hammering
// many accounts). Whichever trips first blocks the request.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 30;

type Bucket = { count: number; resetAt: number };

const emailBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

function touch(
  buckets: Map<string, Bucket>,
  key: string,
  max: number,
): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (existing.count >= max) {
    return false;
  }

  existing.count += 1;
  return true;
}

// Periodic sweep so buckets from one-off callers don't accumulate forever.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of emailBuckets) {
      if (bucket.resetAt <= now) emailBuckets.delete(key);
    }
    for (const [key, bucket] of ipBuckets) {
      if (bucket.resetAt <= now) ipBuckets.delete(key);
    }
  },
  10 * 60 * 1000,
).unref();

export async function rateLimitClientLogin(c: Context, next: Next) {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  let email: string | undefined;
  try {
    const body = await c.req.json();
    if (body && typeof body === "object" && typeof body.email === "string") {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    // Body isn't valid JSON yet -- the route handler's own zod validation
    // will reject it properly; just fall back to IP-only limiting here.
  }

  const ipOk = touch(ipBuckets, ip, MAX_PER_IP);
  const emailOk = email ? touch(emailBuckets, email, MAX_PER_EMAIL) : true;

  if (!ipOk || !emailOk) {
    throw new HTTPException(429, {
      message: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
    });
  }

  return next();
}
