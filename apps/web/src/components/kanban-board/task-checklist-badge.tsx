import CircularProgress from "@/components/ui/circular-progress";
import type { ChecklistProgress } from "@/lib/checklist-progress";

type TaskChecklistBadgeProps = {
  progress: ChecklistProgress;
};

// ASYGNUZ: mismo componente/patrón que ya usa el contador de subtareas en
// el detalle de tarea (task-subtasks.tsx) -- aquí a escala de tarjeta, para
// que un checklist de Markdown en la descripción también se vea de un
// vistazo en el Kanban y en la vista de Lista.
export function TaskChecklistBadge({ progress }: TaskChecklistBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground">
      <CircularProgress
        completed={progress.checked}
        total={progress.total}
        size={11}
        strokeWidth={2}
      />
      <span>
        {progress.checked}/{progress.total}
      </span>
    </span>
  );
}
