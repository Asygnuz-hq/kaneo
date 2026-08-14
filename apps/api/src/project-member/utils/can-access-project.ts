import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { projectMemberTable } from "../../database/schema";

// ASYGNUZ: única fuente de verdad para "¿puede este usuario ver este
// proyecto?". La usan tanto el listado (get-projects.ts) como el middleware
// que protege cada recurso individual (workspace-access-middleware.ts) —
// deben coincidir siempre, o un proyecto puede quedar oculto en la lista
// pero legible por su ID directo (justo el hueco que esto corrige).

// true si el usuario debe ver TODOS los proyectos del workspace sin filtrar
// por project_member — instance admin, o rol de workspace owner/admin.
export async function bypassesProjectFilter(
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

// true si el usuario puede acceder a ESTE proyecto puntual: bypassa el
// filtro, o el proyecto no tiene ningún project_member (visible para todo
// el workspace), o el usuario está explícitamente en su project_member.
export async function canAccessProject(
  projectId: string,
  workspaceId: string,
  userId: string | undefined,
): Promise<boolean> {
  if (await bypassesProjectFilter(workspaceId, userId)) return true;
  if (!userId) return false;

  const [algunMiembro] = await db
    .select({ id: projectMemberTable.id })
    .from(projectMemberTable)
    .where(eq(projectMemberTable.projectId, projectId))
    .limit(1);
  if (!algunMiembro) return true; // sin restringir: visible para el workspace

  const [soyMiembro] = await db
    .select({ id: projectMemberTable.id })
    .from(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(soyMiembro);
}
