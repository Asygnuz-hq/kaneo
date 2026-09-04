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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateGoal } from "@/hooks/mutations/goal/use-create-goal";
import { useDeleteGoal } from "@/hooks/mutations/goal/use-delete-goal";
import { useLinkTaskToGoal } from "@/hooks/mutations/goal/use-link-task-to-goal";
import { useUnlinkTaskFromGoal } from "@/hooks/mutations/goal/use-unlink-task-from-goal";
import { useUpdateGoal } from "@/hooks/mutations/goal/use-update-goal";
import { useGetAvailableTasks } from "@/hooks/queries/goal/use-get-available-tasks";
import { useGetGoalTasks } from "@/hooks/queries/goal/use-get-goal-tasks";
import { useGetGoals } from "@/hooks/queries/goal/use-get-goals";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";

const STATUSES = ["on-track", "at-risk", "off-track", "done"] as const;

const STATUS_BADGE_VARIANT: Record<
  (typeof STATUSES)[number],
  "success" | "warning" | "error" | "secondary"
> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "error",
  done: "secondary",
};

type Goal = {
  id: string;
  title: string;
  description: string;
  status: string;
  targetDate: string | null;
  linkedTaskCount: number;
  completedTaskCount: number;
};

type FormState = {
  title: string;
  description: string;
  status: string;
  targetDate: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  status: "on-track",
  targetDate: "",
};

function goalToFormState(goal: Goal): FormState {
  return {
    title: goal.title,
    description: goal.description,
    status: goal.status,
    targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : "",
  };
}

type GoalEditorProps = {
  projectId: string;
};

export default function GoalEditor({ projectId }: GoalEditorProps) {
  const { t } = useTranslation();
  const { data: goals, isLoading } = useGetGoals(projectId);
  const { mutateAsync: createGoal, isPending: isCreating } = useCreateGoal();
  const { mutateAsync: updateGoal, isPending: isUpdating } = useUpdateGoal();
  const { mutateAsync: deleteGoal } = useDeleteGoal();

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [managingGoal, setManagingGoal] = useState<Goal | null>(null);

  function openCreateForm() {
    setEditingGoal(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEditForm(goal: Goal) {
    setEditingGoal(goal);
    setForm(goalToFormState(goal));
    setIsFormOpen(true);
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error(t("settings:goals.titleRequired"));
      return;
    }

    try {
      if (editingGoal) {
        await updateGoal({
          id: editingGoal.id,
          projectId,
          title: form.title,
          description: form.description,
          status: form.status,
          targetDate: form.targetDate || null,
        });
        toast.success(t("settings:goals.updateSuccess"));
      } else {
        await createGoal({
          projectId,
          title: form.title,
          description: form.description,
          status: form.status,
          targetDate: form.targetDate || undefined,
        });
        toast.success(t("settings:goals.createSuccess"));
      }
      setIsFormOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings:goals.saveError"),
      );
    }
  }

  async function handleDelete() {
    if (!goalToDelete) return;
    try {
      await deleteGoal({ id: goalToDelete.id, projectId });
      toast.success(t("settings:goals.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:goals.deleteError"),
      );
    } finally {
      setGoalToDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:goals.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openCreateForm}>
          {t("settings:goals.createGoal")}
        </Button>
      </div>

      {!goals || goals.length === 0 ? (
        <Empty className="border border-dashed border-border rounded-md py-8">
          <EmptyHeader>
            <EmptyMedia />
            <EmptyTitle>{t("settings:goals.empty")}</EmptyTitle>
            <EmptyDescription>
              {t("settings:goals.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => {
            const percentage =
              goal.linkedTaskCount > 0
                ? Math.round(
                    (goal.completedTaskCount / goal.linkedTaskCount) * 100,
                  )
                : 0;
            return (
              <div
                key={goal.id}
                className="p-3 border border-border rounded-md bg-sidebar space-y-2"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {goal.title}
                      </p>
                      <Badge
                        variant={
                          STATUS_BADGE_VARIANT[
                            goal.status as (typeof STATUSES)[number]
                          ] ?? "secondary"
                        }
                      >
                        {t(`settings:goals.statuses.${goal.status}`)}
                      </Badge>
                    </div>
                    {goal.targetDate && (
                      <p className="text-xs text-muted-foreground">
                        {t("settings:goals.targetDate", {
                          date: formatDateMedium(goal.targetDate),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setManagingGoal(goal)}
                    >
                      {t("settings:goals.manageTasks")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditForm(goal)}
                    >
                      {t("common:actions.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setGoalToDelete(goal)}
                    >
                      {t("common:actions.delete")}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={percentage} className="h-2" />
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {t("settings:goals.taskProgress", {
                      completed: goal.completedTaskCount,
                      total: goal.linkedTaskCount,
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGoal
                ? t("settings:goals.editGoal")
                : t("settings:goals.createGoal")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:goals.formDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings:goals.titleLabel")}</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder={t("settings:goals.titlePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings:goals.descriptionLabel")}</Label>
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
                <Label>{t("settings:goals.statusLabel")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, status: value ?? f.status }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {t(`settings:goals.statuses.${form.status}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`settings:goals.statuses.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("settings:goals.targetDateLabel")}</Label>
                <Input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
              {t("settings:goals.saveGoal")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!goalToDelete}
        onOpenChange={(open) => !open && setGoalToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:goals.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:goals.deleteConfirmDescription", {
                title: goalToDelete?.title,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setGoalToDelete(null)}>
              {t("common:actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("common:actions.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {managingGoal && (
        <ManageGoalTasksDialog
          projectId={projectId}
          goal={managingGoal}
          onClose={() => setManagingGoal(null)}
        />
      )}
    </div>
  );
}

function ManageGoalTasksDialog({
  projectId,
  goal,
  onClose,
}: {
  projectId: string;
  goal: Goal;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: linkedTasks } = useGetGoalTasks(goal.id);
  const { data: availableTasks } = useGetAvailableTasks(projectId);
  const { mutateAsync: linkTask } = useLinkTaskToGoal();
  const { mutateAsync: unlinkTask } = useUnlinkTaskFromGoal();
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const linkedIds = new Set((linkedTasks ?? []).map((t) => t.id));
  const unlinkedTasks = (availableTasks ?? []).filter(
    (t) => !linkedIds.has(t.id),
  );

  async function handleLink() {
    if (!selectedTaskId) return;
    try {
      await linkTask({ goalId: goal.id, taskId: selectedTaskId, projectId });
      setSelectedTaskId("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings:goals.saveError"),
      );
    }
  }

  async function handleUnlink(taskId: string) {
    try {
      await unlinkTask({ goalId: goal.id, taskId, projectId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings:goals.saveError"),
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("settings:goals.manageTasksTitle", { title: goal.title })}
          </DialogTitle>
          <DialogDescription>
            {t("settings:goals.manageTasksDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {!linkedTasks || linkedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:goals.noLinkedTasks")}
              </p>
            ) : (
              linkedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm truncate">
                    {task.number ? `#${task.number} ` : ""}
                    {task.title}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUnlink(task.id)}
                  >
                    {t("settings:goals.unlink")}
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={selectedTaskId}
              onValueChange={(v) => setSelectedTaskId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t("settings:goals.selectTaskPlaceholder")}
                >
                  {unlinkedTasks.find((t) => t.id === selectedTaskId)?.title ??
                    t("settings:goals.selectTaskPlaceholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {unlinkedTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.number ? `#${task.number} ` : ""}
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleLink} disabled={!selectedTaskId}>
              {t("settings:goals.linkTask")}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common:actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
