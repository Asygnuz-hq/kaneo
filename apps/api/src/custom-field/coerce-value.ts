import { HTTPException } from "hono/http-exception";
import type { CustomFieldType } from "./validate-custom-field";

// ASYGNUZ: task_custom_field_value.value is plain text no matter the
// field's type (see the schema.ts comment on that table) -- this is the
// one place that decides what counts as a valid string for each type
// before it's written. A value of `null` means "unset" and skips
// validation entirely (see set-task-custom-field-value.ts, which deletes
// the row instead of storing it).
export function assertValidCustomFieldValue(
  field: { type: CustomFieldType; options: string[] | null },
  value: string,
): void {
  switch (field.type) {
    case "text":
      return;
    case "number":
      if (value.trim() === "" || Number.isNaN(Number(value))) {
        throw new HTTPException(400, {
          message: `"${value}" is not a valid number`,
        });
      }
      return;
    case "date":
      if (Number.isNaN(Date.parse(value))) {
        throw new HTTPException(400, {
          message: `"${value}" is not a valid date`,
        });
      }
      return;
    case "checkbox":
      if (value !== "true" && value !== "false") {
        throw new HTTPException(400, {
          message: 'Checkbox value must be "true" or "false"',
        });
      }
      return;
    case "select": {
      const options = field.options ?? [];
      if (!options.includes(value)) {
        throw new HTTPException(400, {
          message: `"${value}" is not one of this field's options: ${options.join(", ")}`,
        });
      }
      return;
    }
  }
}
