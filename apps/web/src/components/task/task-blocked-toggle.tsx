import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUpdateTaskBlocked } from "@/hooks/mutations/task/use-update-task-blocked";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

// ASYGNUZ: "bloqueada" es un booleano -- un clic alterna el valor, sin
// popover. Mismo patrón que TaskMilestoneToggle. No mueve la tarea de
// columna; solo la marca.
export function TaskBlockedToggle({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { mutate: updateBlocked, isPending } = useUpdateTaskBlocked();

  const isBlocked = Boolean(task.isBlocked);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      title={t("tasks:properties.blockedHint")}
      className={cn(
        "justify-start h-7 px-1.5 gap-1.5",
        isBlocked && "text-destructive-foreground",
      )}
      onClick={() =>
        updateBlocked(
          {
            taskId: task.id,
            projectId: task.projectId,
            isBlocked: !isBlocked,
          },
          {
            onError: (error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : t("tasks:properties.blockedError"),
              );
            },
          },
        )
      }
    >
      <Ban className={cn("size-3.5", isBlocked && "fill-current")} />
      <span className="text-xs font-semibold truncate">
        {isBlocked
          ? t("tasks:properties.unblock")
          : t("tasks:properties.blocked")}
      </span>
    </Button>
  );
}
