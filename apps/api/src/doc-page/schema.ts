import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const docPageIdParam = z.object({ id: z.string() });

export const createDocPageBody = z.object({
  projectId: z.string(),
  parentId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  content: z.string().optional(),
});

export const updateDocPageBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
  // Explicit null moves the page to the root of the project's tree; omitted
  // leaves the current parent untouched.
  parentId: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});
