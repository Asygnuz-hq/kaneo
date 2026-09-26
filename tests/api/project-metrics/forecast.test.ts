import { describe, expect, it } from "vitest";
import {
  classify,
  confidenceFor,
  projectPerson,
} from "../../../apps/api/src/project-metrics/forecast";

describe("forecast: classify", () => {
  it("is idle when nothing is due", () => {
    expect(classify(0, 5)).toEqual({ utilization: 0, status: "idle" });
    expect(classify(0, 0)).toEqual({ utilization: 0, status: "idle" });
  });

  it("flags work with no pace to judge it against, instead of calling it fine", () => {
    expect(classify(3, 0)).toEqual({ utilization: null, status: "no-history" });
  });

  it("draws the lines at 80% and 110%", () => {
    expect(classify(8, 10).status).toBe("ok");
    expect(classify(9, 10).status).toBe("tight");
    expect(classify(11, 10).status).toBe("tight");
    expect(classify(12, 10).status).toBe("overloaded");
  });
});

describe("forecast: confidence", () => {
  it("grows with the amount of history", () => {
    expect(confidenceFor(0)).toBe("low");
    expect(confidenceFor(3)).toBe("low");
    expect(confidenceFor(4)).toBe("medium");
    expect(confidenceFor(7)).toBe("medium");
    expect(confidenceFor(8)).toBe("high");
  });
});

describe("forecast: projectPerson", () => {
  it("turns 16 tasks closed in 8 weeks into 2 per week and about 8.6 for 30 days", () => {
    const result = projectPerson(
      { closedInHistory: 16, upcoming: 4, overdue: 2 },
      30,
    );
    expect(result.velocityPerWeek).toBe(2);
    expect(result.capacity).toBe(8.6);
    expect(result.demand).toBe(6);
    expect(result.utilization).toBe(0.7);
    expect(result.status).toBe("ok");
    expect(result.atRisk).toBe(0);
    expect(result.confidence).toBe("high");
  });

  it("counts overdue work as demand and reports what will not fit", () => {
    const result = projectPerson(
      { closedInHistory: 8, upcoming: 4, overdue: 6 },
      30,
    );
    // 1 task/week -> ~4.3 in a month, against 10 that have to be done
    expect(result.demand).toBe(10);
    expect(result.status).toBe("overloaded");
    expect(result.atRisk).toBe(6);
  });

  it("has no capacity for someone who closed nothing recently", () => {
    const result = projectPerson(
      { closedInHistory: 0, upcoming: 3, overdue: 0 },
      30,
    );
    expect(result.capacity).toBe(0);
    expect(result.status).toBe("no-history");
    expect(result.utilization).toBeNull();
    expect(result.confidence).toBe("low");
  });

  it("scales the window: the same pace covers less time in a shorter window", () => {
    const week = projectPerson(
      { closedInHistory: 16, upcoming: 3, overdue: 0 },
      7,
    );
    expect(week.capacity).toBe(2);
    expect(week.status).toBe("overloaded");
  });
});
