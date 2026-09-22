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
