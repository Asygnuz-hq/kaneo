import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useCreateCustomField from "@/hooks/mutations/custom-field/use-create-custom-field";
import useDeleteCustomField from "@/hooks/mutations/custom-field/use-delete-custom-field";
import useUpdateCustomField from "@/hooks/mutations/custom-field/use-update-custom-field";
import { useGetCustomFields } from "@/hooks/queries/custom-field/use-get-custom-fields";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

// ASYGNUZ: Campos Personalizados. Definidos a nivel de workspace -- un
// campo creado aquí queda disponible en todas las tareas de todos los
// proyectos del workspace. Ver apps/api/src/custom-field/ para el backend.

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/custom-fields",
)({
  component: RouteComponent,
});

type CustomFieldType = "text" | "number" | "date" | "select" | "checkbox";

const FIELD_TYPES: { value: CustomFieldType; labelKey: string }[] = [
  { value: "text", labelKey: "text" },
  { value: "number", labelKey: "number" },
  { value: "date", labelKey: "date" },
  { value: "select", labelKey: "select" },
  { value: "checkbox", labelKey: "checkbox" },
];

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const addOption = () => {
    const trimmed = draft.trim();
    if (!trimmed || options.includes(trimmed)) return;
    onChange([...options, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label>
        {t("settings:workspaceCustomFields.optionsLabel", {
          defaultValue: "Options",
        })}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Badge key={option} variant="outline" className="gap-1 pr-1">
            {option}
            <button
              type="button"
              onClick={() => onChange(options.filter((o) => o !== option))}
              className="rounded-full p-0.5 hover:bg-accent"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("settings:workspaceCustomFields.addOption", {
            defaultValue: "Add an option",
          })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addOption}>
          {t("common:actions.add", { defaultValue: "Add" })}
        </Button>
      </div>
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, canManageWorkspace } = useWorkspacePermission();
  const canManage = canManageWorkspace();
  const workspaceId = workspace?.id ?? "";

  const { data: fields = [] } = useGetCustomFields(workspaceId);
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("text");
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [createError, setCreateError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingField, setEditingField] = useState<{
    id: string;
    type: CustomFieldType;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editError, setEditError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingField, setDeletingField] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const resetCreate = () => {
    setNewName("");
    setNewType("text");
    setNewOptions([]);
    setCreateError("");
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError(
        t("settings:workspaceCustomFields.nameRequired", {
          defaultValue: "Field name is required",
        }),
      );
      return;
    }
    if (newType === "select" && newOptions.length === 0) {
      setCreateError(
        t("settings:workspaceCustomFields.optionsRequired", {
          defaultValue: "Add at least one option",
        }),
      );
      return;
    }

    try {
      await createField.mutateAsync({
        workspaceId,
        name: trimmed,
        type: newType,
        options: newType === "select" ? newOptions : undefined,
      });
      toast.success(
        t("settings:workspaceCustomFields.createSuccess", {
          defaultValue: "Custom field created",
        }),
      );
      setCreateOpen(false);
      resetCreate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceCustomFields.createError", {
              defaultValue: "Failed to create custom field",
            }),
      );
    }
  };

  const openEdit = (field: {
    id: string;
    name: string;
    type: string;
    options: string[] | null;
  }) => {
    setEditingField({ id: field.id, type: field.type as CustomFieldType });
    setEditName(field.name);
    setEditOptions(field.options ?? []);
    setEditError("");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingField) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError(
        t("settings:workspaceCustomFields.nameRequired", {
          defaultValue: "Field name is required",
        }),
      );
      return;
    }
    if (editingField.type === "select" && editOptions.length === 0) {
      setEditError(
        t("settings:workspaceCustomFields.optionsRequired", {
          defaultValue: "Add at least one option",
        }),
      );
      return;
    }

    try {
      await updateField.mutateAsync({
        id: editingField.id,
        name: trimmed,
        options: editingField.type === "select" ? editOptions : undefined,
      });
      toast.success(
        t("settings:workspaceCustomFields.updateSuccess", {
          defaultValue: "Custom field updated",
        }),
      );
      setEditOpen(false);
      setEditingField(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceCustomFields.updateError", {
              defaultValue: "Failed to update custom field",
            }),
      );
    }
  };

  const openDelete = (field: { id: string; name: string }) => {
    setDeletingField(field);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingField) return;
    try {
      await deleteField.mutateAsync({ id: deletingField.id });
      toast.success(
        t("settings:workspaceCustomFields.deleteSuccess", {
          defaultValue: "Custom field deleted",
        }),
      );
      setDeleteOpen(false);
      setDeletingField(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceCustomFields.deleteError", {
              defaultValue: "Failed to delete custom field",
            }),
      );
    }
  };

  return (
    <>
      <PageTitle title={t("settings:workspaceCustomFields.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:workspaceCustomFields.title", {
              defaultValue: "Custom Fields",
            })}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:workspaceCustomFields.subtitle", {
              defaultValue:
                "Extend tasks with fields specific to your team, available across every project in this workspace.",
            })}
          </p>
        </div>

        <CardFrame>
          <Card className="!rounded-none !border-t-0">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <SlidersHorizontal className="size-4" />
                {t("settings:workspaceCustomFields.title", {
                  defaultValue: "Custom Fields",
                })}
              </CardTitle>
              <CardDescription>
                {t("settings:workspaceCustomFields.cardDescription", {
                  defaultValue: "Manage fields that can be set on any task.",
                })}
              </CardDescription>
              {canManage && (
                <CardAction>
                  <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="size-4" />
                    {t("settings:workspaceCustomFields.createField", {
                      defaultValue: "Create Field",
                    })}
                  </Button>
                </CardAction>
              )}
            </CardHeader>
          </Card>

          <Card className="!rounded-none">
            <CardPanel className="p-4">
              {fields.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia>
                      <SlidersHorizontal className="size-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {t("settings:workspaceCustomFields.empty", {
                        defaultValue:
                          "No custom fields yet. Create your first one to get started.",
                      })}
                    </EmptyTitle>
                    <EmptyDescription />
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="divide-y divide-border">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between py-2.5 px-1"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="truncate text-sm">{field.name}</span>
                        <Badge variant="secondary" size="sm">
                          {t(
                            `settings:workspaceCustomFields.types.${field.type}`,
                            { defaultValue: field.type },
                          )}
                        </Badge>
                      </div>
                      {canManage && (
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t(
                              "settings:workspaceCustomFields.editField",
                              { defaultValue: "Edit field" },
                            )}
                            className="h-8 w-8"
                            onClick={() => openEdit(field)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t(
                              "settings:workspaceCustomFields.deleteField",
                              { defaultValue: "Delete" },
                            )}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDelete(field)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardPanel>
          </Card>
        </CardFrame>
      </div>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            resetCreate();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("settings:workspaceCustomFields.createField", {
                defaultValue: "Create Field",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("settings:workspaceCustomFields.createDescription", {
                defaultValue:
                  "The type can't be changed after creation, so pick carefully.",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6 pt-1">
            <div className="space-y-2">
              <Label htmlFor="new-field-name">
                {t("settings:workspaceCustomFields.nameLabel", {
                  defaultValue: "Field name",
                })}
              </Label>
              <Input
                id="new-field-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setCreateError("");
                }}
                placeholder={t(
                  "settings:workspaceCustomFields.namePlaceholder",
                  {
                    defaultValue: "e.g. Client priority",
                  },
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {t("settings:workspaceCustomFields.typeLabel", {
                  defaultValue: "Type",
                })}
              </Label>
              <Select
                value={newType}
                onValueChange={(value) => {
                  setNewType(value as CustomFieldType);
                  setNewOptions([]);
                  setCreateError("");
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {t(`settings:workspaceCustomFields.types.${newType}`, {
                      defaultValue: newType,
                    })}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(
                        `settings:workspaceCustomFields.types.${option.labelKey}`,
                        { defaultValue: option.labelKey },
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newType === "select" && (
              <OptionsEditor options={newOptions} onChange={setNewOptions} />
            )}

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common:actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={handleCreate} disabled={createField.isPending}>
              {t("settings:workspaceCustomFields.createField", {
                defaultValue: "Create Field",
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false);
            setEditingField(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("settings:workspaceCustomFields.editField", {
                defaultValue: "Edit Field",
              })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-6 pt-1">
            <div className="space-y-2">
              <Label htmlFor="edit-field-name">
                {t("settings:workspaceCustomFields.nameLabel", {
                  defaultValue: "Field name",
                })}
              </Label>
              <Input
                id="edit-field-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditError("");
                }}
              />
            </div>

            {editingField?.type === "select" && (
              <OptionsEditor options={editOptions} onChange={setEditOptions} />
            )}

            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditingField(null);
              }}
            >
              {t("common:actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={handleEdit} disabled={updateField.isPending}>
              {t("settings:workspaceCustomFields.saveField", {
                defaultValue: "Save",
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setDeletingField(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:workspaceCustomFields.deleteConfirmTitle", {
                defaultValue: "Delete this field?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:workspaceCustomFields.deleteConfirmDescription", {
                defaultValue:
                  "Every task's value for this field is deleted too. This action cannot be undone.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setDeletingField(null);
              }}
            >
              {t("common:actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteField.isPending}
            >
              {t("settings:workspaceCustomFields.deleteField", {
                defaultValue: "Delete",
              })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
