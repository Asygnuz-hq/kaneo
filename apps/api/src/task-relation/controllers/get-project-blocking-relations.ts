import { and, eq } from "drizzle-orm";
import db from "../../database";
import { taskRelationTable, taskTable } from "../../database/schema";

// ASYGNUZ: bulk variant of getTaskRelations for the "blocks" relation type,
// mirrors getProjectSubtaskRelations -- backs the Gantt view's dependency
// arrows without one getTaskRelations call per task. sourceTaskId blocks
// targetTaskId (source must finish before target starts), matching the
// direction already used in task-relations.tsx.
async function getProjectBlockingRelations(projectId: string) {
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
        eq(taskRelationTable.relationType, "blocks"),
      ),
    );
}

export default getProjectBlockingRelations;
