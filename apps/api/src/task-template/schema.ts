import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const taskTemplateParam = z.object({ id: z.string() });

export const createTaskTemplateBody = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  title: z.string().default(""),
  description: z.string().default(""),
  priority: z.string().default("no-priority"),
  issueType: z.string().default("task"),
  labelIds: z.array(z.string()).default([]),
});

export const updateTaskTemplateBody = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  issueType: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
});
