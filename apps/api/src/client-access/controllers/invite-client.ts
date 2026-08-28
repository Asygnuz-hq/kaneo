import { sendClientPortalInvitationEmail } from "@kaneo/email";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { generateOpaqueToken, hashToken } from "../../client-auth/tokens";
import db, { schema } from "../../database";

const INVITE_TOKEN_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function clientUrl() {
  return process.env.KANEO_CLIENT_URL || "http://localhost:5173";
}

async function inviteClientToProject(
  projectId: string,
  email: string,
  name: string | undefined,
  inviterUserId: string,
) {
  const normalizedEmail = email.trim().toLowerCase();

  const [project] = await db
    .select({ id: schema.projectTable.id, name: schema.projectTable.name })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);
  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const [inviter] = await db
    .select({ name: schema.userTable.name, locale: schema.userTable.locale })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, inviterUserId))
    .limit(1);

  let [account] = await db
    .select()
    .from(schema.clientAccountTable)
    .where(eq(schema.clientAccountTable.email, normalizedEmail))
    .limit(1);

  // Captured before `account` is reassigned below -- an existing, already
  // activated client being granted another project doesn't need a new
  // invite email, just the access row.
  const needsInvite = !account?.passwordHash;
  let inviteLink: string | null = null;

  if (!account) {
    const rawToken = generateOpaqueToken();
    const [created] = await db
      .insert(schema.clientAccountTable)
      .values({
        id: createId(),
        email: normalizedEmail,
        name: name?.trim() || null,
        inviteTokenHash: hashToken(rawToken),
        inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_DURATION_MS),
      })
      .returning();
    if (!created) {
      throw new HTTPException(500, {
        message: "Failed to create client account",
      });
    }
    account = created;
    inviteLink = `${clientUrl()}/portal/accept-invite?token=${rawToken}`;
  } else if (!account.passwordHash) {
    // Pending invite that was never accepted -- issue a fresh token rather
    // than reusing/exposing the old one, and refresh its expiry.
    const rawToken = generateOpaqueToken();
    const [updated] = await db
      .update(schema.clientAccountTable)
      .set({
        inviteTokenHash: hashToken(rawToken),
        inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_DURATION_MS),
        name: name?.trim() || account.name,
      })
      .where(eq(schema.clientAccountTable.id, account.id))
      .returning();
    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to update client account",
      });
    }
    account = updated;
    inviteLink = `${clientUrl()}/portal/accept-invite?token=${rawToken}`;
  }

  const accessWhere = and(
    eq(schema.clientProjectAccessTable.clientAccountId, account.id),
    eq(schema.clientProjectAccessTable.projectId, projectId),
  );
  const [existingAccess] = await db
    .select()
    .from(schema.clientProjectAccessTable)
    .where(accessWhere)
    .limit(1);

  const [insertedAccess] = existingAccess
    ? []
    : await db
        .insert(schema.clientProjectAccessTable)
        .values({
          id: createId(),
          clientAccountId: account.id,
          projectId,
          invitedByUserId: inviterUserId,
        })
        .returning();
  const access = existingAccess ?? insertedAccess;
  if (!access) {
    throw new HTTPException(500, {
      message: "Failed to grant project access",
    });
  }

  if (needsInvite && inviteLink) {
    const result = await sendClientPortalInvitationEmail(
      account.email,
      `${inviter?.name ?? "Someone"} invited you to ${project.name} on Kaneo`,
      {
        projectName: project.name,
        inviterName: inviter?.name ?? "Someone",
        invitationLink: inviteLink,
        locale: inviter?.locale,
      },
    );
    if (result?.success === false && result.reason === "SMTP_NOT_CONFIGURED") {
      console.warn(
        "Client portal invitation created but email not sent -- SMTP not configured",
      );
    }
  }

  return {
    id: access.id,
    clientAccountId: account.id,
    email: account.email,
    name: account.name,
    status: (account.passwordHash ? "active" : "pending") as
      | "active"
      | "pending",
    createdAt: access.createdAt,
    inviteLink,
  };
}

export default inviteClientToProject;
