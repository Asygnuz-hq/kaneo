import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import { columnTable, taskRelationTable, taskTable } from "../database/schema";

// ASYGNUZ: for a "requirement" task, the executed % is not stored -- it is
// the share of its child stories (subtask relations) that sit in a column
// marked isFinal. Returns null when the requirement has no children yet.
export async function computeExecutedPct(
  requirementId: string,
): Promise<number | null> {
  const relations = await db
    .select({ childId: taskRelationTable.targetTaskId })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.sourceTaskId, requirementId),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );

  const childIds = relations.map((r) => r.childId);
  if (childIds.length === 0) return null;

  const children = await db
    .select({ status: taskTable.status, projectId: taskTable.projectId })
    .from(taskTable)
    .where(inArray(taskTable.id, childIds));

  if (children.length === 0) return null;

  const finalSlugs = new Set(
    (
      await db
        .select({ slug: columnTable.slug })
        .from(columnTable)
        .where(
          and(
            inArray(
              columnTable.projectId,
              Array.from(new Set(children.map((c) => c.projectId))),
            ),
            eq(columnTable.isFinal, true),
          ),
        )
    ).map((c) => c.slug),
  );

  const done = children.filter((c) => finalSlugs.has(c.status)).length;
  return Math.round((done / children.length) * 100);
}

export type RequirementProgress = {
  totalStories: number;
  doneStories: number;
  // % of child stories in a final column; null when there are no children yet.
  executedPct: number | null;
  // The child stories themselves, so a list view can link straight to them.
  stories: {
    id: string;
    number: number | null;
    title: string;
    status: string;
    done: boolean;
  }[];
};

// Batch variant for list/overview endpoints: one pass for many requirements.
// Returns story counts alongside the % so a caller can show "3/8 historias".
export async function computeRequirementProgressMany(
  requirementIds: string[],
): Promise<Map<string, RequirementProgress>> {
  const out = new Map<string, RequirementProgress>();
  if (requirementIds.length === 0) return out;

  const relations = await db
    .select({
      parentId: taskRelationTable.sourceTaskId,
      childId: taskRelationTable.targetTaskId,
    })
    .from(taskRelationTable)
    .where(
      and(
        inArray(taskRelationTable.sourceTaskId, requirementIds),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );

  const childIdsByParent = new Map<string, string[]>();
  for (const r of relations) {
    const list = childIdsByParent.get(r.parentId) ?? [];
    list.push(r.childId);
    childIdsByParent.set(r.parentId, list);
  }

  const allChildIds = Array.from(new Set(relations.map((r) => r.childId)));
  const children = allChildIds.length
    ? await db
        .select({
          id: taskTable.id,
          number: taskTable.number,
          title: taskTable.title,
          status: taskTable.status,
          projectId: taskTable.projectId,
        })
        .from(taskTable)
        .where(inArray(taskTable.id, allChildIds))
    : [];
  const childById = new Map(children.map((c) => [c.id, c]));

  const projectIds = Array.from(new Set(children.map((c) => c.projectId)));
  const finalSlugs = new Set(
    projectIds.length
      ? (
          await db
            .select({ slug: columnTable.slug })
            .from(columnTable)
            .where(
              and(
                inArray(columnTable.projectId, projectIds),
                eq(columnTable.isFinal, true),
              ),
            )
        ).map((c) => c.slug)
      : [],
  );

  for (const reqId of requirementIds) {
    const kids = (childIdsByParent.get(reqId) ?? [])
      .map((id) => childById.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const stories = kids.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      status: c.status,
      done: finalSlugs.has(c.status),
    }));
    const done = stories.filter((s) => s.done).length;
    out.set(reqId, {
      totalStories: kids.length,
      doneStories: done,
      executedPct:
        kids.length === 0 ? null : Math.round((done / kids.length) * 100),
      stories,
    });
  }
  return out;
}
