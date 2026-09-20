import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateMedium } from "@/lib/format";

type RecentlyClosedTask = {
  id: string;
  number: number | null;
  title: string;
  projectId: string;
  projectName: string;
  closedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
};

export default function RecentlyClosedSummary({
  totalCount,
  tasks,
  days,
}: {
  totalCount: number;
  tasks: RecentlyClosedTask[];
  days: number;
}) {
  const { t } = useTranslation();

  const visible = tasks.slice(0, 8);
  const remaining = totalCount - visible.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("metrics:recentlyClosed.title", { count: totalCount })}
        </CardTitle>
        <CardDescription>
          {t("metrics:recentlyClosed.description", { days })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("metrics:recentlyClosed.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{task.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {task.projectName}
                    {task.assigneeName ? ` · ${task.assigneeName}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {task.closedAt ? formatDateMedium(task.closedAt) : "–"}
                </span>
              </div>
            ))}
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("metrics:recentlyClosed.andMore", { count: remaining })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
