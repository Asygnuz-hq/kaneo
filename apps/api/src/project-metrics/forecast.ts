// How far back "what this person usually gets done" looks. Eight weeks smooths
// out a holiday or one bad week without hiding a real change in pace.
export const HISTORY_DAYS = 56;

// Demand as a share of capacity. Up to 80% leaves room for what nobody can
// plan (bugs, sick days); past 110% something has to give.
const OK_MAX = 0.8;
const TIGHT_MAX = 1.1;

export type ForecastStatus =
  | "idle"
  | "ok"
  | "tight"
  | "overloaded"
  | "no-history";

export type ForecastConfidence = "low" | "medium" | "high";

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

// "no-history" is not "fine": there is work coming and nothing to judge it
// against, which is exactly when a manager should look.
export function classify(
  demand: number,
  capacity: number,
): { utilization: number | null; status: ForecastStatus } {
  if (demand === 0) {
    return { utilization: 0, status: "idle" };
  }
  if (capacity === 0) {
    return { utilization: null, status: "no-history" };
  }
  const utilization = demand / capacity;
  const status: ForecastStatus =
    utilization <= OK_MAX
      ? "ok"
      : utilization <= TIGHT_MAX
        ? "tight"
        : "overloaded";
  return { utilization: round(utilization, 2), status };
}

// Few closed tasks means the pace is a guess, and the screen should say so.
export function confidenceFor(closedInHistory: number): ForecastConfidence {
  if (closedInHistory >= 8) return "high";
  if (closedInHistory >= 4) return "medium";
  return "low";
}

export type ForecastInput = {
  closedInHistory: number;
  upcoming: number;
  overdue: number;
};

export function projectPerson(
  input: ForecastInput,
  windowDays: number,
  historyDays = HISTORY_DAYS,
) {
  const velocityPerWeek = input.closedInHistory / (historyDays / 7);
  const capacity = velocityPerWeek * (windowDays / 7);
  // Overdue work is not gone, it still has to be done inside the window.
  const demand = input.upcoming + input.overdue;
  const { utilization, status } = classify(demand, capacity);

  return {
    closedInHistory: input.closedInHistory,
    velocityPerWeek: round(velocityPerWeek, 1),
    capacity: round(capacity, 1),
    upcoming: input.upcoming,
    overdue: input.overdue,
    demand,
    utilization,
    status,
    // Tasks that will not fit at this pace.
    atRisk: Math.max(0, Math.ceil(demand - capacity)),
    confidence: confidenceFor(input.closedInHistory),
  };
}
