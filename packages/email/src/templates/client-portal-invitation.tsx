import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { EmailShell, styles } from "./shell";

void React;

// ASYGNUZ: invite email for the Service Desk client portal. Deliberately
// separate from workspace-invitation.tsx (and its i18n/en-US.json-driven
// `copy` prop) -- portal clients aren't workspace members, and wiring this
// into the shared i18n JSON pipeline would mean adding client-portal copy
// to all 19 locale files for one transactional email. Small inline
// en/es table instead, same shape as magic-link.tsx's `messages` map, just
// scoped to this file since only en/es are needed here.

export type ClientPortalInvitationEmailProps = {
  projectName: string;
  inviterName: string;
  invitationLink: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview: "You've been invited to a client portal on Kaneo",
    title: "You're invited to {{projectName}}",
    subtitle:
      "{{inviterName}} invited you to the client portal for {{projectName}}, where you can submit and track support requests.",
    cta: "Set up your account",
    expiry: "This link expires in 7 days.",
    ignore: "If you weren't expecting this, you can safely ignore this email.",
    footer: "Kaneo client portal invitation",
  },
  es: {
    preview: "Te invitaron al portal de clientes de Kaneo",
    title: "Te invitaron a {{projectName}}",
    subtitle:
      "{{inviterName}} te invitó al portal de clientes de {{projectName}}, donde puedes enviar y hacer seguimiento a tus solicitudes de soporte.",
    cta: "Configurar tu cuenta",
    expiry: "Este enlace vence en 7 días.",
    ignore: "Si no esperabas este correo, puedes ignorarlo con confianza.",
    footer: "Invitación al portal de clientes de Kaneo",
  },
} as const;

type ClientPortalEmailLocale = keyof typeof messages;

function resolveLocale(locale?: string | null): ClientPortalEmailLocale {
  const normalized = locale?.toLowerCase().split("-")[0];
  return normalized === "es" ? "es" : "en";
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

const ClientPortalInvitationEmail = ({
  projectName,
  inviterName,
  invitationLink,
  locale,
}: ClientPortalInvitationEmailProps) => {
  const copy = messages[resolveLocale(locale)];
  const values = { projectName, inviterName };

  return (
    <EmailShell
      preview={copy.preview}
      title={interpolate(copy.title, values)}
      subtitle={interpolate(copy.subtitle, values)}
    >
      <Section>
        <Link style={styles.button} href={invitationLink}>
          {copy.cta}
        </Link>
        <Text style={styles.paragraph}>{copy.expiry}</Text>
        <Text style={styles.muted}>{copy.ignore}</Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>{copy.footer}</Text>
      </Section>
    </EmailShell>
  );
};

ClientPortalInvitationEmail.PreviewProps = {
  projectName: "Cliente Demo Jira",
  inviterName: "Juan Manuel",
  invitationLink: "https://kaneo.app/portal/accept-invite?token=abc123",
  locale: "es",
} as ClientPortalInvitationEmailProps;

export default ClientPortalInvitationEmail;
