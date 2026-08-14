import { and, count, eq, isNull, min, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import {
  projectMemberTable,
  projectTable,
  taskTable,
} from "../../database/schema";

type ProjectStatistics = {
  completionPercentage: number;
  totalTasks: number;
  dueDate: Date | null;
};

const EMPTY_STATISTICS: ProjectStatistics = {
  completionPercentage: 0,
  totalTasks: 0,
  dueDate: null,
};

async function getProjectStatistics(
  workspaceId: string,
  includeArchived: boolean,
) {
  const statisticsByProject = new Map<string, ProjectStatistics>();

  // Aggregate in the database instead of loading every task row into memory.
  // This endpoint needs three numbers per project; the previous
  // `with: { tasks: true }` made both the query and the response grow linearly
  // with the number of tasks in the workspace. Scoping by workspaceId through
  // a join (rather than an `IN (...projectIds)` list) keeps the statement size
  // constant regardless of how many projects the workspace has.
  const rows = await db
    .select({
      projectId: taskTable.projectId,
      totalTasks: count(),
      completedTasks: count(
        sql`case when ${taskTable.status} in ('done', 'archived') then 1 end`,
      ),
      dueDate: min(taskTable.dueDate),
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      includeArchived
        ? eq(projectTable.workspaceId, workspaceId)
        : and(
            eq(projectTable.workspaceId, workspaceId),
            isNull(projectTable.archivedAt),
          ),
    )
    .groupBy(taskTable.projectId);

  for (const row of rows) {
    const totalTasks = Number(row.totalTasks);
    const completedTasks = Number(row.completedTasks);

    statisticsByProject.set(row.projectId, {
      totalTasks,
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      dueDate: row.dueDate ?? null,
    });
  }

  return statisticsByProject;
}

// ASYGNUZ: true si el usuario debe ver TODOS los proyectos del workspace sin
// filtrar por project_member — instance admin, o rol de workspace owner/admin.
// Mismo criterio que require-workspace-permission.ts, pero de solo lectura
// (no lanza 403, solo decide si aplica el filtro por proyecto).
async function bypassesProjectFilter(
  workspaceId: string,
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) return true; // llamadas de sistema/sin usuario: no filtrar

  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (user?.role === "admin") return true;

  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  return member?.role === "owner" || member?.role === "admin";
}

// ASYGNUZ: un proyecto sin ninguna fila en project_member sigue visible para
// todo el workspace (comportamiento actual, sin romper nada). En cuanto un
// proyecto tiene AL MENOS un miembro asignado, queda restringido solo a esos
// miembros (más owner/admin/instance-admin, que ya no pasan por aquí).
async function filtrarPorMembresia(
  workspaceId: string,
  userId: string,
  proyectos: (typeof projectTable.$inferSelect)[],
) {
  const restringidosRows = await db
    .selectDistinct({ projectId: projectMemberTable.projectId })
    .from(projectMemberTable)
    .innerJoin(projectTable, eq(projectTable.id, projectMemberTable.projectId))
    .where(eq(projectTable.workspaceId, workspaceId));

  if (restringidosRows.length === 0) return proyectos;
  const restringidos = new Set(restringidosRows.map((r) => r.projectId));

  const misRows = await db
    .select({ projectId: projectMemberTable.projectId })
    .from(projectMemberTable)
    .where(eq(projectMemberTable.userId, userId));
  const misIds = new Set(misRows.map((r) => r.projectId));

  return proyectos.filter((p) => !restringidos.has(p.id) || misIds.has(p.id));
}

async function getProjects(
  workspaceId: string,
  includeArchived = false,
  userId?: string,
) {
  const projects = await db.query.projectTable.findMany({
    where: includeArchived
      ? eq(projectTable.workspaceId, workspaceId)
      : and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
        ),
    // `id` is the deterministic tie-breaker: without it, rows sharing both a
    // position and a createdAt come back in an unspecified order.
    orderBy: (project, { asc }) => [
      asc(project.position),
      asc(project.createdAt),
      asc(project.id),
    ],
  });

  const visibles = (await bypassesProjectFilter(workspaceId, userId))
    ? projects
    : await filtrarPorMembresia(workspaceId, userId as string, projects);

  const statisticsByProject = await getProjectStatistics(
    workspaceId,
    includeArchived,
  );

  return visibles.map((project) => ({
    ...project,
    statistics: statisticsByProject.get(project.id) ?? EMPTY_STATISTICS,
    archivedTasks: [],
    plannedTasks: [],
    columns: [],
  }));
}

export default getProjects;
