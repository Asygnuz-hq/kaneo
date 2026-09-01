import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

// ASYGNUZ: el cliente solo ve SUS propios tickets -- comparar
// requestedByClientId, no solo pertenencia al proyecto (dos clientes
// pueden compartir proyecto y no deben verse los tickets entre sí).
async function getTicket(clientAccountId: string, taskId: string) {
  const [task] = await db
    .select({
      id: schema.taskTable.id,
      number: schema.taskTable.number,
      title: schema.taskTable.title,
      description: schema.taskTable.description,
      status: schema.taskTable.status,
      createdAt: schema.taskTable.createdAt,
      projectId: schema.taskTable.projectId,
      projectName: schema.projectTable.name,
      projectSlug: schema.projectTable.slug,
      requestedByClientId: schema.taskTable.requestedByClientId,
    })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.taskTable.projectId, schema.projectTable.id),
    )
    .where(eq(schema.taskTable.id, taskId));

  if (!task || task.requestedByClientId !== clientAccountId) {
    // 404, no 403: no revelar si el ticket existe si no es del cliente.
    throw new HTTPException(404, { message: "Not found" });
  }

  const comments = await db
    .select({
      id: schema.activityTable.id,
      content: schema.activityTable.content,
      createdAt: schema.activityTable.createdAt,
      userId: schema.activityTable.userId,
      externalUserName: schema.activityTable.externalUserName,
      authorName: schema.userTable.name,
    })
    .from(schema.activityTable)
    .leftJoin(
      schema.userTable,
      eq(schema.activityTable.userId, schema.userTable.id),
    )
    .where(
      and(
        eq(schema.activityTable.taskId, taskId),
        eq(schema.activityTable.type, "comment"),
      ),
    )
    .orderBy(asc(schema.activityTable.createdAt));

  return {
    ...task,
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      // "Tú" queda mejor en el front que repetir el nombre del propio cliente;
      // se resuelve ahí comparando authorName === null && externalUserName.
      authorName: c.authorName ?? c.externalUserName ?? "Equipo",
      fromTeam: c.userId !== null,
    })),
  };
}

export default getTicket;
