import { HTTPException } from "hono/http-exception";

// ASYGNUZ: Campos Personalizados -- 5 tipos iniciales por decisión de
// producto (ver el plan aprobado). "select" es el único tipo que usa
// `options`; los demás la ignoran (se guarda null).
export const VALID_CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "checkbox",
] as const;

export type CustomFieldType = (typeof VALID_CUSTOM_FIELD_TYPES)[number];

export function assertValidCustomFieldType(
  type: string,
): asserts type is CustomFieldType {
  if (!(VALID_CUSTOM_FIELD_TYPES as readonly string[]).includes(type)) {
    throw new HTTPException(400, {
      message: `Invalid custom field type "${type}". Valid values: ${VALID_CUSTOM_FIELD_TYPES.join(", ")}`,
    });
  }
}

// `options` is required (and must be a non-empty list of non-blank,
// case-insensitively unique strings) exactly for "select"; every other
// type must NOT send it, so a field never ends up with stale options it
// doesn't use.
export function assertValidOptions(
  type: CustomFieldType,
  options: string[] | undefined,
): void {
  if (type !== "select") {
    if (options !== undefined) {
      throw new HTTPException(400, {
        message: `"options" only applies to the "select" type, not "${type}"`,
      });
    }
    return;
  }

  if (!options || options.length === 0) {
    throw new HTTPException(400, {
      message: '"select" fields need at least one option',
    });
  }
  const trimmed = options.map((o) => o.trim());
  if (trimmed.some((o) => o.length === 0)) {
    throw new HTTPException(400, {
      message: "Options cannot be blank",
    });
  }
  const seen = new Set(trimmed.map((o) => o.toLowerCase()));
  if (seen.size !== trimmed.length) {
    throw new HTTPException(400, {
      message: "Options must be unique",
    });
  }
}
