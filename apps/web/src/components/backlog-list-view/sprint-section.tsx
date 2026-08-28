import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Play, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCompleteSprint } from "@/hooks/mutations/sprint/use-complete-sprint";
import { useDeleteSprint } from "@/hooks/mutations/sprint/use-delete-sprint";
import { useStartSprint } from "@/hooks/mutations/sprint/use-start-sprint";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Sprint from "@/types/sprint";
import type Task from "@/types/task";
import BacklogTaskRow from "./backlog-task-row";

type SprintSectionProps = {
  sprint: Sprint;
  tasks: Task[];
};

const statusStyles: Record<Sprint["status"], string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-success/15 text-success-foreground",
  completed: "bg-muted/60 text-muted-foreground",
};

// ASYGNUZ: a sprint's tasks, read-only (no drag-and-drop yet -- moving a
// task in or out of a sprint is done via its right-click "Sprint" submenu,
// see task-card-context-menu-content.tsx). Kept separate from
// BacklogSection, which owns the reorderable "Backlog"/"Archived" DnD.
export default function SprintSection({ sprint, tasks }: SprintSectionProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(sprint.status !== "completed");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const { mutateAsync: startSprint, isPending: isStarting } = useStartSprint();
  const { mutateAsync: completeSprint, isPending: isCompleting } =
    useCompleteSprint();
  const { mutateAsync: deleteSprint } = useDeleteSprint();

  const handleStart = async () => {
    try {
      await startSprint(sprint.id);
      toast.success(t("tasks:sprint.startSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:sprint.startError"),
      );
    }
  };

  const handleComplete = async () => {
    try {
      const result = await completeSprint(sprint.id);
      toast.success(
        result.movedToBacklog > 0
          ? t("tasks:sprint.movedToBacklog", { count: result.movedToBacklog })
          : t("tasks:sprint.completeSuccess"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:sprint.completeError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSprint(sprint.id);
      toast.success(t("tasks:sprint.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:sprint.deleteError"),
      );
    }
  };

  return (
    <div className="border-b border-border/50 overflow-auto">
      <div className="flex items-center justify-between py-2 px-4 bg-muted/60 border-b border-border/50">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors min-w-0"
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 flex-shrink-0 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
          <span className="truncate">{sprint.name}</span>
          <span
            className={cn(
              "flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              statusStyles[sprint.status],
            )}
          >
            {t(`tasks:sprint.status${capitalize(sprint.status)}`)}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5 flex-shrink-0">
            {tasks.length}
          </span>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {sprint.status === "planned" && (
            <Button
              variant="ghost"
              size="xs"
              disabled={isStarting}
              onClick={handleStart}
              className="h-6 gap-1 px-2 text-xs"
            >
              <Play className="h-3 w-3" />
              {t("tasks:sprint.start")}
            </Button>
          )}
          {sprint.status === "active" && (
            <Button
              variant="ghost"
              size="xs"
              disabled={isCompleting}
              onClick={() => setIsCompleteOpen(true)}
              className="h-6 gap-1 px-2 text-xs"
            >
              <Square className="h-3 w-3" />
              {t("tasks:sprint.complete")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDeleteOpen(true)}
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            title={t("tasks:sprint.delete")}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-card">
          <AnimatePresence initial={false} mode="popLayout">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              >
                <BacklogTaskRow task={task} disableDragDrop />
              </motion.div>
            ))}
          </AnimatePresence>

          {tasks.length === 0 && (
            <div className="py-6 px-4 text-center text-xs text-muted-foreground">
              {t("tasks:sprint.noTasksInSprint")}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks:sprint.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:sprint.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                />
              }
            >
              {t("tasks:sprint.delete")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks:sprint.complete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:sprint.completeConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={<Button size="sm" onClick={handleComplete} />}
            >
              {t("tasks:sprint.complete")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
