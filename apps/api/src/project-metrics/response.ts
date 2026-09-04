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
