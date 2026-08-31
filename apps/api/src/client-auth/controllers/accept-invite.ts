import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { hashToken } from "../tokens";

async function acceptClientInvite(
  token: string,
  password: string,
  name: string | undefined,
) {
  const [account] = await db
    .select()
    .from(schema.clientAccountTable)
    .where(eq(schema.clientAccountTable.inviteTokenHash, hashToken(token)))
    .limit(1);

  if (
    !account?.inviteTokenExpiresAt ||
    account.inviteTokenExpiresAt.getTime() < Date.now()
  ) {
    throw new HTTPException(400, {
      message: "Este enlace de invitación no es válido o ya venció",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [updated] = await db
    .update(schema.clientAccountTable)
    .set({
      passwordHash,
      name: name?.trim() || account.name,
      inviteTokenHash: null,
      inviteTokenExpiresAt: null,
    })
    .where(eq(schema.clientAccountTable.id, account.id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, {
      message: "Failed to activate client account",
    });
  }

  return updated;
}

export default acceptClientInvite;
