import { and, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import {
  assertValidOptions,
  type CustomFieldType,
} from "../validate-custom-field";

// Name and options only -- the type is fixed at creation (see
// custom-field/index.ts's updateCustomFieldRoute description for why:
// changing it would strand every existing value stored under the old
// type's rules).
async function updateCustomField(
  id: string,
  name: string,
  options: string[] | undefined,
) {
  const [field] = await db
    .select()
    .from(schema.customFieldTable)
    .where(eq(schema.customFieldTable.id, id))
    .limit(1);
  if (!field) {
    throw new HTTPException(404, { message: "Custom field not found" });
  }

  assertValidOptions(field.type as CustomFieldType, options);

  const [duplicate] = await db
    .select({ id: schema.customFieldTable.id })
    .from(schema.customFieldTable)
    .where(
      and(
        eq(schema.customFieldTable.workspaceId, field.workspaceId),
        eq(schema.customFieldTable.name, name),
        ne(schema.customFieldTable.id, id),
      ),
    )
    .limit(1);
  if (duplicate) {
    throw new HTTPException(400, {
      message: `A custom field named "${name}" already exists in this workspace`,
    });
  }

  const [updated] = await db
    .update(schema.customFieldTable)
    .set({ name, options: options ? JSON.stringify(options) : null })
    .where(eq(schema.customFieldTable.id, id))
    .returning();
  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update custom field" });
  }

  return {
    ...updated,
    type: updated.type as CustomFieldType,
    options: updated.options ? (JSON.parse(updated.options) as string[]) : null,
  };
}

export default updateCustomField;
