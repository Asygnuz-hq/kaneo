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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRecurringTask } from "@/hooks/mutations/recurring-task/use-create-recurring-task";
import { useDeleteRecurringTask } from "@/hooks/mutations/recurring-task/use-delete-recurring-task";
import { useUpdateRecurringTask } from "@/hooks/mutations/recurring-task/use-update-recurring-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetRecurringTasks } from "@/hooks/queries/recurring-task/use-get-recurring-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { formatDateMedium } from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { toast } from "@/lib/toast";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"];
const ISSUE_TYPES = ["task", "story", "bug", "epic"];
const FREQUENCIES = ["daily", "weekly", "monthly"];

type RecurringTask = {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  labelIds: string[];
  assigneeId: string | null;
  frequency: string;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
};

type FormState = {
  name: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  labelIds: string[];
  assigneeId: string;
  frequency: string;
  startAt: string;
};

function toDatetimeLocal(value?: string): string {
  const date = value ? new Date(value) : new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  description: "",
  priority: "no-priority",
  issueType: "task",
  labelIds: [],
  assigneeId: "",
  frequency: "weekly",
  startAt: toDatetimeLocal(),
};

function recurringTaskToFormState(task: RecurringTask): FormState {
  return {
    name: task.name,
    title: task.title,
    description: task.description,
    priority: task.priority,
    issueType: task.issueType,
    labelIds: task.labelIds,
    assigneeId: task.assigneeId ?? "",
    frequency: task.frequency,
    startAt: toDatetimeLocal(task.nextRunAt),
  };
}

type RecurringTaskEditorProps = {
  projectId: string;
  workspaceId: string;
};

export default function RecurringTaskEditor({
  projectId,
  workspaceId,
}: RecurringTaskEditorProps) {
  const { t } = useTranslation();
  const { data: recurringTasks, isLoading } = useGetRecurringTasks(projectId);
  const { data: labels } = useGetLabelsByWorkspace(workspaceId);
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { mutateAsync: createRecurringTask, isPending: isCreating } =
    useCreateRecurringTask();
  const { mutateAsync: updateRecurringTask, isPending: isUpdating } =
    useUpdateRecurringTask();
  const { mutateAsync: deleteRecurringTask } = useDeleteRecurringTask();

  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [taskToDelete, setTaskToDelete] = useState<RecurringTask | null>(null);

  const members = workspaceUsers?.members ?? [];

  function openCreateForm() {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEditForm(task: RecurringTask) {
    setEditingTask(task);
    setForm(recurringTaskToFormState(task));
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
    if (!form.name.trim() || !form.title.trim()) {
      toast.error(t("settings:recurringTasks.nameRequired"));
      return;
    }

    const startAtIso = new Date(form.startAt).toISOString();

    try {
      if (editingTask) {
        await updateRecurringTask({
          id: editingTask.id,
          projectId,
          name: form.name,
          title: form.title,
          description: form.description,
          priority: form.priority,
          issueType: form.issueType,
          labelIds: form.labelIds,
          assigneeId: form.assigneeId || null,
          frequency: form.frequency,
          nextRunAt: startAtIso,
        });
        toast.success(t("settings:recurringTasks.updateSuccess"));
      } else {
        await createRecurringTask({
          projectId,
          name: form.name,
          title: form.title,
          description: form.description,
          priority: form.priority,
          issueType: form.issueType,
          labelIds: form.labelIds,
          assigneeId: form.assigneeId || undefined,
          frequency: form.frequency,
          startAt: startAtIso,
        });
        toast.success(t("settings:recurringTasks.createSuccess"));
      }
      setIsFormOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:recurringTasks.saveError"),
      );
    }
  }

  async function handleToggleActive(task: RecurringTask, isActive: boolean) {
    try {
      await updateRecurringTask({ id: task.id, projectId, isActive });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:recurringTasks.saveError"),
      );
    }
  }

  async function handleDelete() {
    if (!taskToDelete) return;
    try {
      await deleteRecurringTask({ id: taskToDelete.id, projectId });
      toast.success(t("settings:recurringTasks.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:recurringTasks.deleteError"),
      );
    } finally {
      setTaskToDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:recurringTasks.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreateForm}>
          {t("settings:recurringTasks.createTask")}
        </Button>
      </div>

      {!recurringTasks || recurringTasks.length === 0 ? (
        <Empty className="border border-dashed border-border rounded-md py-8">
          <EmptyHeader>
            <EmptyMedia />
            <EmptyTitle>{t("settings:recurringTasks.empty")}</EmptyTitle>
            <EmptyDescription>
              {t("settings:recurringTasks.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {recurringTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-4 p-3 border border-border rounded-md bg-sidebar"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{task.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t(`settings:recurringTasks.frequencies.${task.frequency}`)}
                  {" · "}
                  {t("settings:recurringTasks.nextRun", {
                    date: formatDateMedium(task.nextRunAt),
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={task.isActive}
                  onCheckedChange={(checked) =>
                    handleToggleActive(task, checked)
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditForm(task)}
                >
                  {t("common:actions.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTaskToDelete(task)}
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
              {editingTask
                ? t("settings:recurringTasks.editTask")
                : t("settings:recurringTasks.createTask")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:recurringTasks.formDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings:recurringTasks.nameLabel")}</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("settings:recurringTasks.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings:recurringTasks.taskTitleLabel")}</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings:recurringTasks.taskDescriptionLabel")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("settings:recurringTasks.frequencyLabel")}</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, frequency: value ?? f.frequency }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {t(
                        `settings:recurringTasks.frequencies.${form.frequency}`,
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>
                        {t(`settings:recurringTasks.frequencies.${frequency}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  {editingTask
                    ? t("settings:recurringTasks.nextRunLabel")
                    : t("settings:recurringTasks.startAtLabel")}
                </Label>
                <Input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startAt: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("settings:recurringTasks.priorityLabel")}</Label>
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
                <Label>{t("settings:recurringTasks.issueTypeLabel")}</Label>
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

            <div className="space-y-1.5">
              <Label>{t("settings:recurringTasks.assigneeLabel")}</Label>
              <Select
                value={form.assigneeId || "__unassigned__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    assigneeId: value === "__unassigned__" ? "" : (value ?? ""),
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {members.find((m) => m.userId === form.assigneeId)?.user
                      ?.name ?? t("settings:recurringTasks.unassigned")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">
                    {t("settings:recurringTasks.unassigned")}
                  </SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.user?.name ?? member.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {labels && labels.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("settings:recurringTasks.labelsLabel")}</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {labels.map((label) => (
                    <label
                      key={label.id}
                      htmlFor={`recurring-task-label-${label.id}`}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <Checkbox
                        id={`recurring-task-label-${label.id}`}
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
              {t("settings:recurringTasks.saveTask")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!taskToDelete}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:recurringTasks.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:recurringTasks.deleteConfirmDescription", {
                name: taskToDelete?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setTaskToDelete(null)}>
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
