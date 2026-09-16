import { cleanup, render, screen } from "@testing-library/react";
import { addDays, subDays } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortfolioSummary from "./portfolio-summary";

afterEach(() => {
  cleanup();
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function valueFor(labelKey: string) {
  const label = screen.getByText(labelKey);
  return label.previousElementSibling?.textContent;
}

const today = new Date();

const projects = [
  // Not started: no tasks yet.
  {
    id: "a",
    statistics: { completionPercentage: 0, totalTasks: 0, dueDate: null },
  },
  // In progress, due in 3 days: counts toward "due this week".
  {
    id: "b",
    statistics: {
      completionPercentage: 40,
      totalTasks: 5,
      dueDate: addDays(today, 3).toISOString(),
    },
  },
  // Overdue: due 5 days ago, still incomplete.
  {
    id: "c",
    statistics: {
      completionPercentage: 50,
      totalTasks: 4,
      dueDate: subDays(today, 5).toISOString(),
    },
  },
  // Complete, even though its due date is in the past — must NOT count as overdue.
  {
    id: "d",
    statistics: {
      completionPercentage: 100,
      totalTasks: 8,
      dueDate: subDays(today, 10).toISOString(),
    },
  },
  // In progress, due well beyond the 7-day window.
  {
    id: "e",
    statistics: {
      completionPercentage: 70,
      totalTasks: 3,
      dueDate: addDays(today, 20).toISOString(),
    },
  },
];

describe("PortfolioSummary", () => {
  it("computes the active/overdue/due-this-week/average KPIs correctly", () => {
    render(<PortfolioSummary projects={projects} />);

    expect(valueFor("workspace:projects.portfolio.activeProjects")).toBe("5");
    expect(valueFor("workspace:projects.portfolio.overdue")).toBe("1");
    expect(valueFor("workspace:projects.portfolio.dueThisWeek")).toBe("1");
    // (40 + 50 + 100 + 70) / 4 started projects = 65 — the not-started
    // project must be excluded so it doesn't drag the average down.
    expect(valueFor("workspace:projects.portfolio.avgProgress")).toBe("65%");
  });

  it("buckets projects into the status distribution correctly", () => {
    render(<PortfolioSummary projects={projects} />);

    expect(
      screen
        .getByText(/workspace:projects\.portfolio\.notStarted/)
        .closest("div"),
    ).toHaveTextContent("(1)");
    expect(
      screen
        .getByText(/workspace:projects\.portfolio\.inProgress/)
        .closest("div"),
    ).toHaveTextContent("(3)");
    expect(
      screen
        .getByText(/workspace:projects\.portfolio\.complete/)
        .closest("div"),
    ).toHaveTextContent("(1)");
  });

  it("renders zeroed KPIs without crashing when there are no projects", () => {
    render(<PortfolioSummary projects={[]} />);

    expect(valueFor("workspace:projects.portfolio.activeProjects")).toBe("0");
    expect(valueFor("workspace:projects.portfolio.overdue")).toBe("0");
    expect(valueFor("workspace:projects.portfolio.avgProgress")).toBe("0%");
  });
});
