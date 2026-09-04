import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateTaskTemplate } from "@/hooks/mutations/task-template/use-create-task-template";
import { useDeleteTaskTemplate } from "@/hooks/mutations/task-template/use-delete-task-template";
import { useUpdateTaskTemplate } from "@/hooks/mutations/task-template/use-update-task-template";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetTaskTemplates } from "@/hooks/queries/task-template/use-get-task-templates";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { toast } from "@/lib/toast";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"];
const ISSUE_TYPES = ["task", "story", "bug", "epic"];

type TaskTemplate = {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  labelIds: string[];
};

type FormState = {
  name: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  labelIds: string[];
};

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  description: "",
  priority: "no-priority",
  issueType: "task",
  labelIds: [],
};

function templateToFormState(template: TaskTemplate): FormState {
  return {
    name: template.name,
    title: template.title,
    description: template.description,
    priority: template.priority,
    issueType: template.issueType,
    labelIds: template.labelIds,
  };
}

type TaskTemplateEditorProps = {
  projectId: string;
  workspaceId: string;
};

export default function TaskTemplateEditor({
  projectId,
  workspaceId,
}: TaskTemplateEditorProps) {
  const { t } = useTranslation();
  const { data: templates, isLoading } = useGetTaskTemplates(projectId);
  const { data: labels } = useGetLabelsByWorkspace(workspaceId);
  const { mutateAsync: createTemplate, isPending: isCreating } =
    useCreateTaskTemplate();
  const { mutateAsync: updateTemplate, isPending: isUpdating } =
    useUpdateTaskTemplate();
  const { mutateAsync: deleteTemplate } = useDeleteTaskTemplate();

  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(
    null,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [templateToDelete, setTemplateToDelete] = useState<TaskTemplate | null>(
    null,
  );

  function openCreateForm() {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEditForm(template: TaskTemplate) {
    setEditingTemplate(template);
    setForm(templateToFormState(template));
    setIsFormOpen(true);
  }

  function toggleLabel(labelId: string) {
    setForm((f) => ({
      ...f,
      labelIds: f.labelIds.includes(labelId)
        ? f.labelIds.filter((id) => id !== labelId)
        : [...f.labelIds, labelId],
    }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error(t("settings:taskTemplates.nameRequired"));
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate({ id: editingTemplate.id, projectId, ...form });
        toast.success(t("settings:taskTemplates.updateSuccess"));
      } else {
        await createTemplate({ projectId, ...form });
        toast.success(t("settings:taskTemplates.createSuccess"));
      }
      setIsFormOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:taskTemplates.saveError"),
      );
    }
  }

  async function handleDelete() {
    if (!templateToDelete) return;
    try {
      await deleteTemplate({ id: templateToDelete.id, projectId });
      toast.success(t("settings:taskTemplates.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:taskTemplates.deleteError"),
      );
    } finally {
      setTemplateToDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:taskTemplates.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreateForm}>
          {t("settings:taskTemplates.createTemplate")}
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <Empty className="border border-dashed border-border rounded-md py-8">
          <EmptyHeader>
            <EmptyMedia />
            <EmptyTitle>{t("settings:taskTemplates.empty")}</EmptyTitle>
            <EmptyDescription>
              {t("settings:taskTemplates.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between gap-4 p-3 border border-border rounded-md bg-sidebar"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{template.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getPriorityLabel(template.priority)} ·{" "}
                  {t(`tasks:type.${template.issueType}`)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditForm(template)}
                >
                  {t("common:actions.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTemplateToDelete(template)}
                >
                  {t("common:actions.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate
                ? t("settings:taskTemplates.editTemplate")
                : t("settings:taskTemplates.createTemplate")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:taskTemplates.formDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings:taskTemplates.nameLabel")}</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("settings:taskTemplates.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings:taskTemplates.defaultTitleLabel")}</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder={t(
                  "settings:taskTemplates.defaultTitlePlaceholder",
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                {t("settings:taskTemplates.defaultDescriptionLabel")}
              </Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("settings:taskTemplates.priorityLabel")}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, priority: value ?? f.priority }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{getPriorityLabel(form.priority)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {getPriorityLabel(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("settings:taskTemplates.issueTypeLabel")}</Label>
                <Select
                  value={form.issueType}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, issueType: value ?? f.issueType }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {t(`tasks:type.${form.issueType}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_TYPES.map((issueType) => (
                      <SelectItem key={issueType} value={issueType}>
                        {t(`tasks:type.${issueType}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {labels && labels.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("settings:taskTemplates.labelsLabel")}</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {labels.map((label) => (
                    <label
                      key={label.id}
                      htmlFor={`template-label-${label.id}`}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <Checkbox
                        id={`template-label-${label.id}`}
                        checked={form.labelIds.includes(label.id)}
                        onCheckedChange={() => toggleLabel(label.id)}
                      />
                      {label.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
              {t("settings:taskTemplates.saveTemplate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:taskTemplates.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:taskTemplates.deleteConfirmDescription", {
                name: templateToDelete?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setTemplateToDelete(null)}>
              {t("common:actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("common:actions.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
