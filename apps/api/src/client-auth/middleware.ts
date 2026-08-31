import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { CLIENT_SESSION_COOKIE_NAME } from "./cookie";
import { hashToken } from "./tokens";

export type ClientAuthVariables = {
  Variables: {
    clientAccountId: string;
    clientEmail: string;
  };
};

export async function clientAuthMiddleware(c: Context, next: Next) {
  const token = getCookie(c, CLIENT_SESSION_COOKIE_NAME);
  if (!token) {
    throw new HTTPException(401, { message: "Not signed in" });
  }

  const [row] = await db
    .select({
      clientAccountId: schema.clientSessionTable.clientAccountId,
      expiresAt: schema.clientSessionTable.expiresAt,
      email: schema.clientAccountTable.email,
    })
    .from(schema.clientSessionTable)
    .innerJoin(
      schema.clientAccountTable,
      eq(
        schema.clientSessionTable.clientAccountId,
        schema.clientAccountTable.id,
      ),
    )
    .where(eq(schema.clientSessionTable.tokenHash, hashToken(token)))
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new HTTPException(401, { message: "Session expired" });
  }

  c.set("clientAccountId", row.clientAccountId);
  c.set("clientEmail", row.email);
  return next();
}
