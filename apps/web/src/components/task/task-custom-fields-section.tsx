import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useSetTaskCustomFieldValue from "@/hooks/mutations/custom-field/use-set-task-custom-field-value";
import useUnsetTaskCustomFieldValue from "@/hooks/mutations/custom-field/use-unset-task-custom-field-value";
import { useGetCustomFields } from "@/hooks/queries/custom-field/use-get-custom-fields";
import { useGetTaskCustomFieldValues } from "@/hooks/queries/custom-field/use-get-task-custom-field-values";
import { toast } from "@/lib/toast";

// ASYGNUZ: Campos Personalizados -- one input per workspace field,
// pre-filled with whatever this task already has set. Values save on
// blur/change rather than as-you-type, same reasoning as the rest of this
// sidebar's inline-editable fields: a custom field's value is validated
// server-side (coerce-value.ts), so firing a request per keystroke would
// mean a wrong-type error toast on every character typed into e.g. a
// number field.

type CustomFieldType = "text" | "number" | "date" | "select" | "checkbox";

type CustomFieldInputProps = {
  taskId: string;
  field: {
    id: string;
    name: string;
    type: CustomFieldType;
    options: string[] | null;
  };
  currentValue: string | undefined;
};

function CustomFieldInput({
  taskId,
  field,
  currentValue,
}: CustomFieldInputProps) {
  const { t } = useTranslation();
  const setValue = useSetTaskCustomFieldValue();
  const unsetValue = useUnsetTaskCustomFieldValue();
  const [draft, setDraft] = useState(currentValue ?? "");

  // Keep the draft in sync when the task/value changes underneath us (e.g.
  // switching to a different task while the sidebar stays open).
  useEffect(() => {
    setDraft(currentValue ?? "");
  }, [currentValue]);

  const commit = async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === (currentValue ?? "")) return;

    try {
      if (!trimmed) {
        if (currentValue !== undefined) {
          await unsetValue.mutateAsync({
            taskId,
            customFieldId: field.id,
          });
        }
        return;
      }
      await setValue.mutateAsync({
        taskId,
        customFieldId: field.id,
        value: trimmed,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:properties.customFieldSaveError", {
              defaultValue: "Failed to save value",
            }),
      );
      setDraft(currentValue ?? "");
    }
  };

  if (field.type === "checkbox") {
    return (
      <Checkbox
        checked={draft === "true"}
        onCheckedChange={(checked) => {
          const next = checked ? "true" : "";
          setDraft(next);
          commit(next);
        }}
      />
    );
  }

  if (field.type === "select") {
    return (
      <Select
        // Always a string (never undefined), even when unset -- passing
        // undefined on the first render makes base-ui treat the Select as
        // uncontrolled, then flips it to controlled the moment a value is
        // set, which React warns about loudly. An empty string keeps it
        // controlled from the start; SelectValue's placeholder covers the
        // "no option selected" display.
        value={draft}
        onValueChange={(value) => {
          const next = value ?? "";
          setDraft(next);
          commit(next);
        }}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue
            placeholder={t("tasks:properties.customFieldUnset", {
              defaultValue: "Not set",
            })}
          />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      className="h-7 text-xs"
      placeholder={t("tasks:properties.customFieldUnset", {
        defaultValue: "Not set",
      })}
    />
  );
}

export default function TaskCustomFieldsSection({
  taskId,
  workspaceId,
}: {
  taskId: string;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const { data: fields = [] } = useGetCustomFields(workspaceId);
  const { data: values = [] } = useGetTaskCustomFieldValues(taskId);

  if (fields.length === 0) return null;

  const valueByFieldId = new Map(values.map((v) => [v.customFieldId, v.value]));

  return (
    <div className="hidden lg:flex px-3 flex-col gap-3 p-2">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-foreground/70 px-2">
          {t("tasks:properties.customFields", {
            defaultValue: "Custom fields",
          })}
        </span>
        {fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-1 px-2">
            <span className="text-[11px] text-muted-foreground">
              {field.name}
            </span>
            <CustomFieldInput
              taskId={taskId}
              field={{
                id: field.id,
                name: field.name,
                type: field.type as CustomFieldType,
                options: field.options,
              }}
              currentValue={valueByFieldId.get(field.id) ?? undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
