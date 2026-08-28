import { responseTimestamp, z } from "../openapi";

// ASYGNUZ: a user explicitly granted access to a restricted project.
export const projectMemberSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("ProjectMember");

export const projectMemberListSchema = z.array(projectMemberSchema);

// The bare project_member row, as returned by add/remove -- no joined user
// details, since those endpoints already have the userId from the request.
export const projectMembershipSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    userId: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("ProjectMembership");

export const removedProjectMemberSchema = z
  .object({
    projectId: z.string(),
    userId: z.string(),
  })
  .openapi("RemovedProjectMember");
