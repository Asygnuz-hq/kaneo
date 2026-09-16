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
      description:
        "Contracted budget in cents, agreed with the client. Null if not set.",
    }),
    currency: z.string(),
    costCents: z.number().openapi({
      description:
        "Internal cost of billable time logged so far (hours x each logger's cost rate, snapshotted on their entries) — what this work costs the company.",
    }),
    billedCents: z.number().openapi({
      description:
        "What should be invoiced to the client for billable time logged so far (hours x each logger's bill rate, snapshotted on their entries). Compared against budgetCents.",
    }),
    marginCents: z.number().openapi({
      description: "billedCents minus costCents.",
    }),
    billableSeconds: z.number(),
    nonBillableSeconds: z.number(),
    unratedCostSeconds: z.number().openapi({
      description:
        "Billable seconds logged by someone with no cost rate set — not included in costCents, since there's no rate to cost them with.",
    }),
    unratedBillSeconds: z.number().openapi({
      description:
        "Billable seconds logged by someone with no bill rate set — not included in billedCents.",
    }),
    projectedBilledCents: z.number().nullable().openapi({
      description:
        "Simple burn-rate projection (billed so far / % complete). Null until the project has some completed work to project from.",
    }),
  })
  .openapi("ProjectBudget");
