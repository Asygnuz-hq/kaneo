import { createId } from "@paralleldrive/cuid2";
import db, { schema } from "../database";
import { CLIENT_SESSION_DURATION_MS } from "./cookie";
import { generateOpaqueToken, hashToken } from "./tokens";

export async function createClientSession(
  clientAccountId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
): Promise<string> {
  const token = generateOpaqueToken();
  await db.insert(schema.clientSessionTable).values({
    id: createId(),
    clientAccountId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + CLIENT_SESSION_DURATION_MS),
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null,
  });
  return token;
}
