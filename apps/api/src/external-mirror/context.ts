import { AsyncLocalStorage } from "node:async_hooks";

// Everything the mirror writes (a comment, a status, a new task...) goes
// through the same code paths as a human's edit, and those publish events
// that the Generic Webhook would send straight back to the other side --
// which would apply them, publish again, and never stop. Marking the work the
// mirror itself does lets the webhook sender stay silent for it. The event
// bus emits synchronously, so the mark reaches the handlers.
const applying = new AsyncLocalStorage<true>();

export function runAsMirror<T>(work: () => Promise<T>): Promise<T> {
  return applying.run(true, work);
}

export function isApplyingMirror(): boolean {
  return applying.getStore() === true;
}
