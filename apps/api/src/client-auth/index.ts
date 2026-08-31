import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "../openapi";
import acceptClientInvite from "./controllers/accept-invite";
import getClientAccountById from "./controllers/get-me";
import loginClient from "./controllers/login";
import logoutClient from "./controllers/logout";
import {
  CLIENT_SESSION_COOKIE_NAME,
  clearClientSessionCookie,
  setClientSessionCookie,
} from "./cookie";
import { createClientSession } from "./create-session";
import { type ClientAuthVariables, clientAuthMiddleware } from "./middleware";

// ASYGNUZ: Service Desk client portal auth. Deliberately NOT built on the
// apiRouter()/createRoute() OpenAPI pattern the rest of the API uses --
// that pattern requires BaseVariables (userId/user/session, better-auth's
// shape), and a portal client is a different kind of caller entirely, with
// its own session mechanism (see client-auth/middleware.ts). Kept as a
// plain Hono router with manual zod validation instead of stretching
// BaseVariables to cover both.

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const acceptInviteBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().trim().min(1).max(120).optional(),
});

function requestMeta(c: {
  req: { header: (name: string) => string | undefined };
}) {
  return {
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: c.req.header("user-agent") ?? null,
  };
}

async function parseJsonBody<T extends z.ZodType>(
  c: { req: { json: () => Promise<unknown> } },
  schema: T,
): Promise<z.infer<T>> {
  const raw = await c.req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HTTPException(400, {
      message: issue ? issue.message : "Solicitud inválida",
    });
  }
  return parsed.data;
}

const clientAuth = new Hono<ClientAuthVariables>();

clientAuth.post("/login", async (c) => {
  const { email, password } = await parseJsonBody(c, loginBody);
  const account = await loginClient(email, password);
  const token = await createClientSession(account.id, requestMeta(c));
  setClientSessionCookie(c, token);
  return c.json({ id: account.id, email: account.email, name: account.name });
});

clientAuth.post("/accept-invite", async (c) => {
  const { token, password, name } = await parseJsonBody(c, acceptInviteBody);
  const account = await acceptClientInvite(token, password, name);
  const sessionToken = await createClientSession(account.id, requestMeta(c));
  setClientSessionCookie(c, sessionToken);
  return c.json({ id: account.id, email: account.email, name: account.name });
});

clientAuth.post("/logout", async (c) => {
  const token = getCookie(c, CLIENT_SESSION_COOKIE_NAME);
  if (token) {
    await logoutClient(token);
  }
  clearClientSessionCookie(c);
  return c.json({ ok: true });
});

clientAuth.get("/me", clientAuthMiddleware, async (c) => {
  const account = await getClientAccountById(c.get("clientAccountId"));
  if (!account) {
    throw new HTTPException(401, { message: "Not signed in" });
  }
  return c.json(account);
});

export default clientAuth;
