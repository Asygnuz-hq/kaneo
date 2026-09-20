// A task's completedAt is recalculated on every column change, never
// accumulated: entering a final column stamps "now" (unless it was already
// stamped -- e.g. an unrelated edit while it stays in that column), leaving
// one clears it. Reopening later and re-closing gets a fresh timestamp.
export function resolveCompletedAt(
  isFinal: boolean,
  currentCompletedAt: Date | null,
): Date | null {
  if (!isFinal) return null;
  return currentCompletedAt ?? new Date();
}
