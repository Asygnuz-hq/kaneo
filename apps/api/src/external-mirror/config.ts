// ASYGNUZ: single fixed integration (kaneo-mia's "Tecnología" project ->
// this instance's Financieramente tracking project), not a generic
// multi-tenant webhook receiver -- hence a hardcoded source key instead of
// a per-sender config table.
const MIRROR_SOURCE = "financieramente-tecnologia";

export function mirrorSource(): string {
  return MIRROR_SOURCE;
}

export function mirrorSecret(): string {
  return process.env.FINANCIEREMENTE_MIRROR_SECRET ?? "";
}

export function mirrorTargetProjectId(): string {
  return process.env.FINANCIEREMENTE_MIRROR_PROJECT_ID ?? "";
}

export function isMirrorEnabled(): boolean {
  return Boolean(mirrorSecret() && mirrorTargetProjectId());
}

// Base URL of kaneo-mia's own instance, so the mirror can call back and
// register the reverse mapping (see register-reverse-mirror.ts) right after
// creating a local copy. Reverse sync degrades gracefully without this: the
// forward mirror still works, updates on our side just never propagate back.
export function financieramenteBaseUrl(): string {
  return process.env.FINANCIEREMENTE_BASE_URL ?? "";
}

// The same person often has a different account on each side: their
// financieramentecu.com work email at kaneo-mia, a personal or asygnuz.com
// one here. Matching by email alone then misses them and the mirror falls
// back to a name-only external assignee. Keys are kaneo-mia emails, values
// the account that person uses here.
const ASSIGNEE_EMAIL_ALIASES: Record<string, string> = {
  "nicolas.loaiza@financieramentecu.com": "nlo9619loaocam@gmail.com",
  "warles.rivera@financieramentecu.com": "warlesrivera123@gmail.com",
  "john.agudelo@financieramentecu.com": "johnaagudelo@gmail.com",
  "andres.agudelo@financieramentecu.com": "andres.agudelo@asygnuz.com",
};

export function localAssigneeEmail(
  email: string | null | undefined,
): string | null | undefined {
  const key = email?.trim().toLowerCase();
  if (!key) {
    return email;
  }
  return ASSIGNEE_EMAIL_ALIASES[key] ?? email;
}

// Columns are matched by slug, and a renamed column keeps its old slug:
// Comisiones' "Code Review" was born as "In Review", so it still sends
// "in-review". Keyed by kaneo-mia project name (what the payload carries).
const STATUS_ALIASES_BY_PROJECT: Record<string, Record<string, string>> = {
  Comisiones: { "in-review": "code-review" },
};

export function localStatusFor(
  status: string,
  projectName: string | null | undefined,
): string {
  const aliases = projectName ? STATUS_ALIASES_BY_PROJECT[projectName] : null;
  return aliases?.[status] ?? status;
}

// The way back: what this instance sends to kaneo-mia must use kaneo-mia's
// own names, so a change made here never reassigns their task to the wrong
// account (an unknown email there unassigns it) nor drops it into "planned"
// (an unknown slug there).
const REMOTE_ASSIGNEE_EMAIL: Record<string, string> = Object.fromEntries(
  Object.entries(ASSIGNEE_EMAIL_ALIASES).map(([remote, local]) => [
    local,
    remote,
  ]),
);

export function remoteAssigneeEmail(
  email: string | null | undefined,
): string | null | undefined {
  const key = email?.trim().toLowerCase();
  if (!key) {
    return email;
  }
  return REMOTE_ASSIGNEE_EMAIL[key] ?? email;
}

// "back-log" is a column created here by hand; kaneo-mia only knows "backlog".
const REMOTE_STATUS_ALWAYS: Record<string, string> = { "back-log": "backlog" };

export function remoteStatusFor(
  status: string | null,
  labels: string[],
): string | null {
  if (!status) {
    return status;
  }
  for (const [projectName, aliases] of Object.entries(
    STATUS_ALIASES_BY_PROJECT,
  )) {
    if (!labels.includes(projectName)) {
      continue;
    }
    for (const [remote, local] of Object.entries(aliases)) {
      if (local === status) {
        return remote;
      }
    }
  }
  return REMOTE_STATUS_ALWAYS[status] ?? status;
}
