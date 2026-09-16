import { addDays, startOfToday, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { isProjectOverdue } from "./project-status";

describe("isProjectOverdue", () => {
  it("is false when there is no due date", () => {
    expect(
      isProjectOverdue({
        completionPercentage: 0,
        totalTasks: 1,
        dueDate: null,
      }),
    ).toBe(false);
  });

  it("is false once the project is complete, even with a past due date", () => {
    expect(
      isProjectOverdue({
        completionPercentage: 100,
        totalTasks: 5,
        dueDate: subDays(new Date(), 10).toISOString(),
      }),
    ).toBe(false);
  });

  it("is false for a project due today — due today is not overdue yet", () => {
    // The exact boundary that caused a mismatch between the table's badge
    // and the KPI count: a project due at any point "today" must not flip
    // to overdue until tomorrow starts.
    expect(
      isProjectOverdue({
        completionPercentage: 40,
        totalTasks: 5,
        dueDate: startOfToday().toISOString(),
      }),
    ).toBe(false);
  });

  it("is true for an incomplete project whose due date has fully passed", () => {
    expect(
      isProjectOverdue({
        completionPercentage: 40,
        totalTasks: 5,
        dueDate: subDays(startOfToday(), 1).toISOString(),
      }),
    ).toBe(true);
  });

  it("is false for a project due in the future", () => {
    expect(
      isProjectOverdue({
        completionPercentage: 40,
        totalTasks: 5,
        dueDate: addDays(new Date(), 3).toISOString(),
      }),
    ).toBe(false);
  });
});
