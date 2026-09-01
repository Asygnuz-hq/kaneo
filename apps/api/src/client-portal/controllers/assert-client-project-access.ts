import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

// ASYGNUZ: única fuente de verdad para "¿este cliente del portal puede
// tocar este proyecto?" -- la usan tanto la creación de tickets como el
// listado/detalle, para no repetir la misma consulta en cada controller.
export async function assertClientProjectAccess(
  clientAccountId: string,
  projectId: string,
): Promise<void> {
  const [access] = await db
    .select({ id: schema.clientProjectAccessTable.id })
    .from(schema.clientProjectAccessTable)
    .where(
      and(
        eq(schema.clientProjectAccessTable.clientAccountId, clientAccountId),
        eq(schema.clientProjectAccessTable.projectId, projectId),
      ),
    )
    .limit(1);

  if (!access) {
    // 404, no 403: no revelar si el proyecto existe a quien no tiene acceso.
    throw new HTTPException(404, { message: "Not found" });
  }
}
