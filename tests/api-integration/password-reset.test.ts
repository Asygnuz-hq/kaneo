import { beforeEach, describe, expect, it, vi } from "vitest";

const sendPasswordResetEmail = vi.fn();

vi.mock("@kaneo/email", () => ({
  isSmtpConfigured: () => true,
  sendPasswordResetEmail: (...args: unknown[]) =>
    sendPasswordResetEmail(...args),
}));

const { createApp } = await import("../../apps/api/src/index");
const { resetTestDatabase } = await import("./helpers/database");
const { createWorkspaceMember } = await import("./helpers/fixtures");

describe("API integration: password reset", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sendPasswordResetEmail.mockClear();
  });

  it("emails a reset link, and the link's token sets a new password", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { app } = createApp();

    const requestRes = await app.request("/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:1337",
      },
      body: JSON.stringify({
        email: member.user.email,
        redirectTo: "http://localhost:5173/auth/reset-password",
      }),
    });
    expect(requestRes.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const [, , data] = sendPasswordResetEmail.mock.calls[0] as [
      string,
      string,
      { resetLink: string },
    ];
    const token = new URL(data.resetLink).searchParams.get("token");
    expect(token).toBeTruthy();

    const newPassword = "a-brand-new-password-123";
    const resetRes = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword, token }),
    });
    expect(resetRes.status).toBe(200);

    const oldSignIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: member.user.email,
        password: "wrong-old-password",
      }),
    });
    expect(oldSignIn.status).not.toBe(200);

    const newSignIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: member.user.email, password: newPassword }),
    });
    expect(newSignIn.status).toBe(200);
  });

  it("does not leak whether an email exists", async () => {
    await resetTestDatabase();
    const { app } = createApp();

    const res = await app.request("/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:1337",
      },
      body: JSON.stringify({
        email: "no-such-user@example.com",
        redirectTo: "http://localhost:5173/auth/reset-password",
      }),
    });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
