import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForecastSummary from "./forecast-summary";

afterEach(() => {
  cleanup();
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

const projection = {
  velocityPerWeek: 1,
  capacity: 4.3,
  upcoming: 4,
  overdue: 3,
  demand: 7,
  utilization: 1.63,
  status: "overloaded" as const,
  atRisk: 3,
  confidence: "high" as const,
};

const noUnassigned = { upcoming: 0, overdue: 0 };
const noReliability = { onTimePercentage: null, averageDeviationDays: null };

describe("ForecastSummary", () => {
  it("says so when nothing is due", () => {
    render(
      <ForecastSummary
        team={{ ...projection, demand: 0, status: "idle", atRisk: 0 }}
        people={[]}
        unassigned={noUnassigned}
        scheduleReliability={noReliability}
        days={30}
      />,
    );
    expect(screen.getByText("metrics:forecast.empty")).toBeTruthy();
  });

  it("shows each person's verdict and how many tasks won't fit", () => {
    render(
      <ForecastSummary
        team={projection}
        people={[
          {
            ...projection,
            userId: "u1",
            userName: "Ana Gómez",
            userImage: null,
          },
        ]}
        unassigned={noUnassigned}
        scheduleReliability={noReliability}
        days={30}
      />,
    );
    expect(screen.getByText("Ana Gómez")).toBeTruthy();
    // the same verdict for the person and for the team
    expect(
      screen.getAllByText("metrics:forecast.status.overloaded"),
    ).toHaveLength(2);
    expect(screen.getAllByText(/forecast\.atRisk/)).toHaveLength(2);
  });

  it("flags a rough estimate when there is little history", () => {
    render(
      <ForecastSummary
        team={projection}
        people={[
          {
            ...projection,
            confidence: "low",
            userId: "u1",
            userName: "Ana Gómez",
            userImage: null,
          },
        ]}
        unassigned={noUnassigned}
        scheduleReliability={noReliability}
        days={30}
      />,
    );
    expect(screen.getByText(/metrics:forecast.lowConfidence/)).toBeTruthy();
  });

  it("shows unassigned work and date reliability only when there is something to say", () => {
    const { rerender } = render(
      <ForecastSummary
        team={projection}
        people={[]}
        unassigned={{ upcoming: 2, overdue: 1 }}
        scheduleReliability={{
          onTimePercentage: 72.4,
          averageDeviationDays: 1.5,
        }}
        days={30}
      />,
    );
    expect(screen.getByText(/metrics:forecast.unassigned/)).toBeTruthy();
    expect(screen.getByText(/metrics:forecast.reliability.*72/)).toBeTruthy();

    rerender(
      <ForecastSummary
        team={projection}
        people={[
          { ...projection, userId: "u1", userName: "Ana", userImage: null },
        ]}
        unassigned={noUnassigned}
        scheduleReliability={noReliability}
        days={30}
      />,
    );
    expect(screen.queryByText(/metrics:forecast.unassigned/)).toBeNull();
    expect(screen.queryByText(/metrics:forecast.reliability/)).toBeNull();
  });
});
