import { Clock, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import useCreateTimeEntry from "@/hooks/queries/time-entry/use-create-time-entry";
import useGetTimeEntriesByTaskId from "@/hooks/queries/time-entry/use-get-time-entries";
import useUpdateTimeEntry from "@/hooks/queries/time-entry/use-update-time-entry";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

type TaskTimeTrackerProps = {
  taskId: string;
};

export default function TaskTimeTracker({ taskId }: TaskTimeTrackerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: timeEntries = [], isLoading } =
    useGetTimeEntriesByTaskId(taskId);
  const { mutate: createEntry, isPending: isCreating } = useCreateTimeEntry();
  const { mutate: updateEntry, isPending: isUpdating } = useUpdateTimeEntry();

  const [activeElapsed, setActiveElapsed] = useState<number>(0);

  const activeEntry = timeEntries.find(
    (entry) => !entry.endTime && entry.userId === user?.id,
  );

  // Sum up duration of completed entries
  const totalLoggedSeconds = timeEntries.reduce((acc, entry) => {
    return acc + (entry.duration ?? 0);
  }, 0);

  // Live update active elapsed time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeEntry) {
      const start = new Date(activeEntry.startTime).getTime();
      interval = setInterval(() => {
        const now = Date.now();
        setActiveElapsed(Math.floor((now - start) / 1000));
      }, 1000);

      // Initialize immediately
      setActiveElapsed(Math.floor((Date.now() - start) / 1000));
    } else {
      setActiveElapsed(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

  const totalTime = totalLoggedSeconds + activeElapsed;

  const handleStartTimer = () => {
    if (activeEntry || !taskId) return;
    createEntry({
      taskId,
      startTime: new Date().toISOString(),
    });
  };

  const handleStopTimer = () => {
    if (!activeEntry) return;
    updateEntry({
      taskId,
      id: activeEntry.id,
      startTime: activeEntry.startTime,
      endTime: new Date().toISOString(),
    });
  };

  if (isLoading && timeEntries.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-semibold text-foreground">
            {formatDuration(totalTime)}
          </span>
        </div>
        <div>
          {activeEntry ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 gap-1"
              onClick={handleStopTimer}
              disabled={isUpdating}
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{t("tasks:timeTracker.stop", "Stop")}</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              onClick={handleStartTimer}
              disabled={isCreating}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{t("tasks:timeTracker.start", "Start")}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
