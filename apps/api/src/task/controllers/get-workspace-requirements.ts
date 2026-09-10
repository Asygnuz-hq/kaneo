import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { computeRequirementProgressMany } from "../executed-pct";

// ASYGNUZ: every "requirement" task in a workspace, with its structured spec
// and the child-story progress already computed. Backs the dashboard's
// Requisitos de Negocio overview in one call instead of walking the board
// project by project and fetching each requirement on its own.
async function getWorkspaceRequirements(workspaceId: string) {
  const rows = await db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      createdAt: taskTable.createdAt,
      spec: taskTable.spec,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        eq(taskTable.issueType, "requirement"),
      ),
    )
    .orderBy(asc(taskTable.createdAt));

  const progressById = await computeRequirementProgressMany(
    rows.map((r) => r.id),
  );

  return rows.map((r) => {
    const progress = progressById.get(r.id);
    return {
      ...r,
      totalStories: progress?.totalStories ?? 0,
      doneStories: progress?.doneStories ?? 0,
      executedPct: progress?.executedPct ?? null,
    };
  });
}

export default getWorkspaceRequirements;
