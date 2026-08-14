import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { projectMemberTable, projectTable } from "../../database/schema";

async function addProjectMember(projectId: string, userId: string) {
  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);
  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  // El usuario debe ser miembro del workspace dueño del proyecto — si no,
  // agregarlo aquí no serviría de nada (no podría autenticarse contra ese
  // workspace de todas formas) y sería fácil de agregar por error.
  const [workspaceMember] = await db
    .select({ userId: schema.workspaceUserTable.userId })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, project.workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);
  if (!workspaceMember) {
    throw new HTTPException(400, {
      message: "El usuario no pertenece al workspace de este proyecto",
    });
  }

  const membershipWhere = and(
    eq(projectMemberTable.projectId, projectId),
    eq(projectMemberTable.userId, userId),
  );

  const [existing] = await db
    .select()
    .from(projectMemberTable)
    .where(membershipWhere)
    .limit(1);
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(projectMemberTable)
      .values({ id: createId(), projectId, userId })
      .returning();
    return created;
  } catch (error) {
    // Dos requests concurrentes agregando a la misma persona: el segundo
    // choca contra project_member_project_id_user_id_unique en vez de
    // encontrar la fila del select de arriba (condición de carrera). En ese
    // caso el resultado deseado ya existe — devolverlo en vez de un 500.
    const isUniqueViolation =
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "23505";
    if (!isUniqueViolation) throw error;

    const [row] = await db
      .select()
      .from(projectMemberTable)
      .where(membershipWhere)
      .limit(1);
    if (!row) throw error;
    return row;
  }
}

export default addProjectMember;
