import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkloadSummary from "./workload-summary";

afterEach(() => {
  cleanup();
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
  }),
}));

describe("WorkloadSummary", () => {
  it("renders nothing when there is no workload data", () => {
    const { container } = render(<WorkloadSummary workload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an overdue badge only for people who actually have overdue tasks", () => {
    render(
      <WorkloadSummary
        workload={[
          {
            userId: "u1",
            userName: "Jorge",
            userImage: null,
            openCount: 5,
            totalCount: 8,
            overdueCount: 2,
            byProject: [],
          },
          {
            userId: "u2",
            userName: "Juan Manuel",
            userImage: null,
            openCount: 3,
            totalCount: 3,
            overdueCount: 0,
            byProject: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("Jorge")).toBeInTheDocument();
    expect(screen.getByText("Juan Manuel")).toBeInTheDocument();
    // Only Jorge (overdueCount: 2) gets a badge — Juan Manuel (0) gets none.
    expect(screen.getAllByText(/metrics:overdueCount/)).toHaveLength(1);
    expect(screen.getByText("metrics:overdueCount:2")).toBeInTheDocument();
  });

  it("shows the per-project breakdown only when a person spans more than one project", () => {
    render(
      <WorkloadSummary
        workload={[
          {
            userId: "u1",
            userName: "Jorge",
            userImage: null,
            openCount: 5,
            totalCount: 8,
            overdueCount: 0,
            byProject: [
              {
                projectId: "p1",
                projectName: "Project A",
                openCount: 3,
                totalCount: 5,
              },
              {
                projectId: "p2",
                projectName: "Project B",
                openCount: 2,
                totalCount: 3,
              },
            ],
          },
          {
            userId: "u2",
            userName: "Solo Project Person",
            userImage: null,
            openCount: 2,
            totalCount: 2,
            overdueCount: 0,
            byProject: [
              {
                projectId: "p1",
                projectName: "Project A",
                openCount: 2,
                totalCount: 2,
              },
            ],
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Project A (3) · Project B (2)"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Project A \(2\)/)).not.toBeInTheDocument();
  });

  it("falls back to the unassigned label when userName is null", () => {
    render(
      <WorkloadSummary
        workload={[
          {
            userId: null,
            userName: null,
            userImage: null,
            openCount: 1,
            totalCount: 1,
            overdueCount: 0,
            byProject: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("metrics:unassigned")).toBeInTheDocument();
  });
});
