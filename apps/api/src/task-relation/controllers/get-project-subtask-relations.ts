import { and, eq } from "drizzle-orm";
import db from "../../database";
import { taskRelationTable, taskTable } from "../../database/schema";

// ASYGNUZ: variante en bloque de getTaskRelations, para pintar la lista de un
// proyecto como árbol (Épica -> Tareas -> Subtareas) sin pedir las relaciones
// tarea por tarea. Solo trae relaciones "subtask" cuyo padre (source) vive en
// este proyecto -- suficiente para agrupar visualmente, no reemplaza el panel
// de detalle de cada tarea (que sigue usando getTaskRelations).
async function getProjectSubtaskRelations(projectId: string) {
  return db
    .select({
      id: taskRelationTable.id,
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRelationTable.sourceTaskId))
    .where(
      and(
        eq(taskTable.projectId, projectId),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );
}

export default getProjectSubtaskRelations;
