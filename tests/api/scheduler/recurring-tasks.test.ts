import { describe, expect, it } from "vitest";
import { computeNextRunAt } from "../../../apps/api/src/scheduler/recurring-tasks";

describe("computeNextRunAt", () => {
  it("advances daily by one day", () => {
    const current = new Date("2026-07-12T09:00:00.000Z");
    const now = new Date("2026-07-12T10:00:00.000Z");
    expect(computeNextRunAt(current, "daily", now)).toEqual(
      new Date("2026-07-13T09:00:00.000Z"),
    );
  });

  it("advances weekly by seven days", () => {
    const current = new Date("2026-07-12T09:00:00.000Z");
    const now = new Date("2026-07-12T10:00:00.000Z");
    expect(computeNextRunAt(current, "weekly", now)).toEqual(
      new Date("2026-07-19T09:00:00.000Z"),
    );
  });

  it("advances monthly by one month", () => {
    const current = new Date("2026-07-12T09:00:00.000Z");
    const now = new Date("2026-07-12T10:00:00.000Z");
    expect(computeNextRunAt(current, "monthly", now)).toEqual(
      new Date("2026-08-12T09:00:00.000Z"),
    );
  });

  it("skips missed occurrences instead of backfilling them", () => {
    // The server was "down" for 10 days -- the daily occurrence for every
    // day in between was missed. The next run should be the first one
    // still in the future, not a burst of 10 catch-up tasks.
    const current = new Date("2026-07-01T09:00:00.000Z");
    const now = new Date("2026-07-12T10:00:00.000Z");
    expect(computeNextRunAt(current, "daily", now)).toEqual(
      new Date("2026-07-13T09:00:00.000Z"),
    );
  });

  it("always returns a time strictly after now", () => {
    const current = new Date("2026-07-12T09:00:00.000Z");
    const now = new Date("2026-07-12T09:00:00.000Z");
    const next = computeNextRunAt(current, "daily", now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});
