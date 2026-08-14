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

  const [existing] = await db
    .select({ id: projectMemberTable.id })
    .from(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, userId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(projectMemberTable)
    .values({ id: createId(), projectId, userId })
    .returning();

  return created;
}

export default addProjectMember;
