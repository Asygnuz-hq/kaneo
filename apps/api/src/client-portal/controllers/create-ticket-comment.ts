import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import createComment from "../../activity/controllers/create-comment";
import db, { schema } from "../../database";

// ASYGNUZ: reusa el mismo createComment que usa el equipo internamente --
// userId null + external marca el comentario como del portal de cliente,
// mismo patrón que ya usaban los webhooks de Gitea/GitHub para comentarios
// que no vienen de un usuario de Kaneo.
async function createTicketComment(
  clientAccountId: string,
  taskId: string,
  content: string,
) {
  const [task] = await db
    .select({ requestedByClientId: schema.taskTable.requestedByClientId })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, taskId));

  if (!task || task.requestedByClientId !== clientAccountId) {
    throw new HTTPException(404, { message: "Not found" });
  }

  if (!content.trim()) {
    throw new HTTPException(400, {
      message: "El comentario no puede estar vacío",
    });
  }

  const [client] = await db
    .select({
      name: schema.clientAccountTable.name,
      email: schema.clientAccountTable.email,
    })
    .from(schema.clientAccountTable)
    .where(eq(schema.clientAccountTable.id, clientAccountId));

  return createComment(taskId, null, content.trim(), {
    userName: client?.name || client?.email || "Cliente",
    source: "client-portal",
  });
}

export default createTicketComment;
