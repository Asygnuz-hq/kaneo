import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

async function loginClient(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const [account] = await db
    .select()
    .from(schema.clientAccountTable)
    .where(eq(schema.clientAccountTable.email, normalizedEmail))
    .limit(1);

  // Same error whether the account doesn't exist, has no password yet
  // (invite not accepted), or the password is wrong -- never confirm which
  // emails have a portal account.
  if (!account?.passwordHash) {
    throw new HTTPException(401, {
      message: "Correo o contraseña incorrectos",
    });
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    throw new HTTPException(401, {
      message: "Correo o contraseña incorrectos",
    });
  }

  return account;
}

export default loginClient;
