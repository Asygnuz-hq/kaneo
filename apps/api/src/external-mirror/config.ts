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
