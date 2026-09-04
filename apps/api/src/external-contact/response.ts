import { responseTimestamp, z } from "../openapi";

// ASYGNUZ: alguien sin cuenta de Kaneo a quien igual se le puede marcar como
// responsable de una tarea. Ver el comentario en database/schema.ts.

export const externalContactSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("ExternalContact");

export const externalContactListSchema = z.array(externalContactSchema);

export const removedExternalContactSchema = z
  .object({ id: z.string() })
  .openapi("RemovedExternalContact");
