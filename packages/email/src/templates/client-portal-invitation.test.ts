import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import ClientPortalInvitationEmail from "./client-portal-invitation";

describe("ClientPortalInvitationEmail", () => {
  it("renders in English by default", async () => {
    const html = await render(
      createElement(ClientPortalInvitationEmail, {
        projectName: "Acme Support",
        inviterName: "Jane",
        invitationLink: "https://kaneo.example/portal/accept-invite?token=abc",
      }),
    );

    expect(html).toContain("invited to Acme Support");
    expect(html).toContain("Set up your account");
  });

  it("renders in Spanish for an es locale", async () => {
    const html = await render(
      createElement(ClientPortalInvitationEmail, {
        projectName: "Soporte Acme",
        inviterName: "Juana",
        invitationLink: "https://kaneo.example/portal/accept-invite?token=abc",
        locale: "es-CO",
      }),
    );

    expect(html).toContain("Te invitaron a Soporte Acme");
    expect(html).toContain("Configurar tu cuenta");
    expect(html).toContain("Juana te invitó");
  });

  it("falls back to English for an unsupported locale", async () => {
    const html = await render(
      createElement(ClientPortalInvitationEmail, {
        projectName: "Acme Support",
        inviterName: "Jane",
        invitationLink: "https://kaneo.example/portal/accept-invite?token=abc",
        locale: "ja-JP",
      }),
    );

    expect(html).toContain("invited to Acme Support");
  });
});
