import { asc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import type { CustomFieldType } from "../validate-custom-field";

async function listCustomFields(workspaceId: string) {
  const fields = await db
    .select()
    .from(schema.customFieldTable)
    .where(eq(schema.customFieldTable.workspaceId, workspaceId))
    .orderBy(asc(schema.customFieldTable.position));

  return fields.map((field) => ({
    ...field,
    type: field.type as CustomFieldType,
    options: field.options ? (JSON.parse(field.options) as string[]) : null,
  }));
}

export default listCustomFields;
