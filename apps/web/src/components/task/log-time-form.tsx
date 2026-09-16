import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useCreateTimeEntry from "@/hooks/queries/time-entry/use-create-time-entry";
import { toast } from "@/lib/toast";

type LogTimeFormProps = {
  taskId: string;
};

function todayLocalDate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

// A logged day always starts at 09:00 local time — the exact clock time
// doesn't matter for reporting or budget (only the duration does), so this
// avoids asking the person for a start/end time they don't actually know.
const LOGGED_DAY_START_HOUR = 9;

export default function LogTimeForm({ taskId }: LogTimeFormProps) {
  const { t } = useTranslation();
  const { mutateAsync: createEntry, isPending } = useCreateTimeEntry();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayLocalDate());
  const [hours, setHours] = useState("");

  const reset = () => {
    setDate(todayLocalDate());
    setHours("");
  };

  const handleSubmit = async () => {
    const parsedHours = Number.parseFloat(hours);
    if (Number.isNaN(parsedHours) || parsedHours <= 0) {
      toast.error(t("tasks:timeTracker.logTime.invalidHours"));
      return;
    }

    const start = new Date(`${date}T00:00:00`);
    start.setHours(LOGGED_DAY_START_HOUR, 0, 0, 0);
    const end = new Date(start.getTime() + parsedHours * 60 * 60 * 1000);

    try {
      await createEntry({
        taskId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      toast.success(t("tasks:timeTracker.logTime.success"));
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:timeTracker.logTime.error"),
      );
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1">
          <span>{t("tasks:timeTracker.logTime.trigger")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="log-time-date" className="text-xs">
              {t("tasks:timeTracker.logTime.dateLabel")}
            </Label>
            <Input
              id="log-time-date"
              type="date"
              className="h-8"
              value={date}
              max={todayLocalDate()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="log-time-hours" className="text-xs">
              {t("tasks:timeTracker.logTime.hoursLabel")}
            </Label>
            <Input
              id="log-time-hours"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.25"
              placeholder="0.0"
              className="h-8"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              autoFocus
            />
          </div>
          <Button
            size="sm"
            className="h-8"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {t("tasks:timeTracker.logTime.submit")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
