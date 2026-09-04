import { Diamond } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUpdateTaskMilestone } from "@/hooks/mutations/task/use-update-task-milestone";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

// ASYGNUZ: a diferencia de estado/prioridad/responsable, "hito" es un
// booleano -- no hace falta un popover con opciones, un clic ya alterna el
// valor. Reusado en las variantes responsive del sidebar de propiedades.
export function TaskMilestoneToggle({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { mutate: updateMilestone, isPending } = useUpdateTaskMilestone();

  const isMilestone = Boolean(task.isMilestone);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      title={t("tasks:properties.milestoneHint")}
      className={cn(
        "justify-start h-7 px-1.5 gap-1.5",
        isMilestone && "text-primary",
      )}
      onClick={() =>
        updateMilestone(
          {
            taskId: task.id,
            projectId: task.projectId,
            isMilestone: !isMilestone,
          },
          {
            onError: (error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : t("tasks:properties.milestoneError"),
              );
            },
          },
        )
      }
    >
      <Diamond className={cn("size-3.5", isMilestone && "fill-current")} />
      <span className="text-xs font-semibold truncate">
        {t("tasks:properties.milestone")}
      </span>
    </Button>
  );
}
