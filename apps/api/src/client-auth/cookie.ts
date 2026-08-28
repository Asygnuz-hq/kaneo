import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { getDefaultCookieAttributes } from "../utils/get-default-cookie-attributes";

// ASYGNUZ: separate cookie from better-auth's own "session" cookie -- a
// client portal session is a different, much narrower identity (see
// database/schema.ts's clientSessionTable comment) and should never be
// confused with an internal workspace session by anything reading cookies.
export const CLIENT_SESSION_COOKIE_NAME = "kaneo_client_session";

export const CLIENT_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const apiUrl = process.env.KANEO_API_URL || "http://localhost:1337";
const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";

function cookieAttributes() {
  return getDefaultCookieAttributes({
    apiUrl,
    clientUrl,
    cookieDomain: process.env.COOKIE_DOMAIN,
  });
}

export function setClientSessionCookie(c: Context, token: string) {
  setCookie(c, CLIENT_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: CLIENT_SESSION_DURATION_MS / 1000,
    ...cookieAttributes(),
  });
}

export function clearClientSessionCookie(c: Context) {
  deleteCookie(c, CLIENT_SESSION_COOKIE_NAME, {
    path: "/",
    ...cookieAttributes(),
  });
}
