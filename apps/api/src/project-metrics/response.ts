import { z } from "../openapi";

export const statusCountSchema = z.object({
  status: z.string(),
  columnName: z.string().nullable(),
  count: z.number(),
});

export const priorityCountSchema = z.object({
  priority: z.string(),
  count: z.number(),
});

export const workloadEntrySchema = z.object({
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  userImage: z.string().nullable(),
  openCount: z.number(),
  totalCount: z.number(),
});

export const projectMetricsSchema = z
  .object({
    totalTasks: z.number(),
    completedTasks: z.number(),
    overdueTasks: z.number(),
    statusCounts: z.array(statusCountSchema),
    priorityCounts: z.array(priorityCountSchema),
    workload: z.array(workloadEntrySchema),
  })
  .openapi("ProjectMetrics");

export const workspaceWorkloadProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  openCount: z.number(),
  totalCount: z.number(),
});

export const workspaceWorkloadEntrySchema = z.object({
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  userImage: z.string().nullable(),
  openCount: z.number(),
  totalCount: z.number(),
  overdueCount: z.number(),
  byProject: z.array(workspaceWorkloadProjectSchema),
});

export const workspaceMetricsSchema = z
  .object({
    totalOpenTasks: z.number(),
    totalOverdueTasks: z.number(),
    workload: z.array(workspaceWorkloadEntrySchema),
  })
  .openapi("WorkspaceMetrics");

export const projectBudgetSchema = z
  .object({
    budgetCents: z.number().nullable().openapi({
      description: "Contracted budget in cents. Null if not set.",
    }),
    currency: z.string(),
    spentCents: z.number().openapi({
      description:
        "Cost of billable time logged so far (hours x the rate snapshotted on each entry).",
    }),
    billableSeconds: z.number(),
    nonBillableSeconds: z.number(),
    unratedBillableSeconds: z.number().openapi({
      description:
        "Billable seconds logged by someone with no hourly rate set — not included in spentCents, since there's no rate to cost them with.",
    }),
    projectedTotalCents: z.number().nullable().openapi({
      description:
        "Simple burn-rate projection (spent so far / % complete). Null until the project has some completed work to project from.",
    }),
  })
  .openapi("ProjectBudget");
