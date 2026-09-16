import { startOfToday } from "date-fns";

export type ProjectStatistics = {
  completionPercentage: number;
  totalTasks: number;
  dueDate: string | Date | null;
};

// A project is "overdue" once its due date's calendar day has fully passed —
// something due today is still on time, not overdue, until tomorrow starts.
// Shared by the portfolio KPI cards and the projects table so both agree on
// which projects get the "Atrasado" treatment.
export function isProjectOverdue(statistics: ProjectStatistics) {
  if (!statistics.dueDate || statistics.completionPercentage >= 100) {
    return false;
  }
  return new Date(statistics.dueDate) < startOfToday();
}
