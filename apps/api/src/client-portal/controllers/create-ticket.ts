import { HTTPException } from "hono/http-exception";
import createTask from "../../task/controllers/create-task";
import { assertClientProjectAccess } from "./assert-client-project-access";

// ASYGNUZ: Service Desk fase 2. Un ticket ES una tarea normal de Kaneo --
// entra directo al tablero del proyecto en la columna "to-do", con
// requestedByClientId marcado, para que el equipo la vea y la trabaje con
// las mismas herramientas que ya usa (nada de un sistema de tickets
// paralelo). El cliente solo puede crear en proyectos a los que tiene
// acceso explícito.
async function createTicket(
  clientAccountId: string,
  projectId: string,
  title: string,
  description: string | undefined,
) {
  await assertClientProjectAccess(clientAccountId, projectId);

  if (!title.trim()) {
    throw new HTTPException(400, { message: "El título es obligatorio" });
  }

  return createTask({
    projectId,
    currentUserId: "",
    title: title.trim(),
    status: "to-do",
    description,
    requestedByClientId: clientAccountId,
  });
}

export default createTicket;
