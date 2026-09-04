import { createId } from "@paralleldrive/cuid2";
import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import {
  assertValidCustomFieldType,
  assertValidOptions,
  type CustomFieldType,
} from "../validate-custom-field";

async function createCustomField(
  workspaceId: string,
  name: string,
  type: string,
  options: string[] | undefined,
) {
  assertValidCustomFieldType(type);
  assertValidOptions(type, options);

  const [existing] = await db
    .select({ id: schema.customFieldTable.id })
    .from(schema.customFieldTable)
    .where(
      and(
        eq(schema.customFieldTable.workspaceId, workspaceId),
        eq(schema.customFieldTable.name, name),
      ),
    )
    .limit(1);
  if (existing) {
    throw new HTTPException(400, {
      message: `A custom field named "${name}" already exists in this workspace`,
    });
  }

  const [countRow] = await db
    .select({ value: count() })
    .from(schema.customFieldTable)
    .where(eq(schema.customFieldTable.workspaceId, workspaceId));
  const fieldCount = countRow?.value ?? 0;

  const [created] = await db
    .insert(schema.customFieldTable)
    .values({
      id: createId(),
      workspaceId,
      name,
      type,
      options: options ? JSON.stringify(options) : null,
      position: fieldCount,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create custom field" });
  }

  return {
    ...created,
    type: created.type as CustomFieldType,
    options: created.options ? (JSON.parse(created.options) as string[]) : null,
  };
}

export default createCustomField;
