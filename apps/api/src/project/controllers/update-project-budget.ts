import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function updateProjectBudget({
  id,
  workspaceId,
  budgetCents,
  currency,
}: {
  id: string;
  workspaceId: string;
  budgetCents: number | null;
  currency: string;
}) {
  const [existingProject] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    );

  if (!existingProject) {
    throw new HTTPException(404, {
      message:
        "Project doesn't exist or doesn't belong to the specified workspace",
    });
  }

  const [updatedProject] = await db
    .update(projectTable)
    .set({ budgetCents, currency })
    .where(eq(projectTable.id, id))
    .returning();

  return updatedProject;
}

export default updateProjectBudget;
