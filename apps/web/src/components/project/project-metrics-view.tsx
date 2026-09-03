import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGetProjectMetrics } from "@/hooks/queries/project-metrics/use-get-project-metrics";
import { getInitials } from "@/lib/get-initials";
import { getPriorityLabel } from "@/lib/i18n/domain";

type ProjectMetricsViewProps = {
  projectId: string;
};

function BarRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const percentage = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

export default function ProjectMetricsView({
  projectId,
}: ProjectMetricsViewProps) {
  const { t } = useTranslation();
  const { data: metrics, isLoading } = useGetProjectMetrics(projectId);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("metrics:loading")}
      </div>
    );
  }

  if (!metrics) return null;

  const maxStatusCount = Math.max(
    0,
    ...metrics.statusCounts.map((s) => s.count),
  );
  const maxPriorityCount = Math.max(
    0,
    ...metrics.priorityCounts.map((p) => p.count),
  );
  const maxWorkloadCount = Math.max(
    0,
    ...metrics.workload.map((w) => w.totalCount),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>{t("metrics:totalTasks")}</CardDescription>
            <CardTitle className="text-3xl">{metrics.totalTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("metrics:completedTasks")}</CardDescription>
            <CardTitle className="text-3xl">{metrics.completedTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("metrics:overdueTasks")}</CardDescription>
            <CardTitle className="text-3xl">{metrics.overdueTasks}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("metrics:byStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.statusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("metrics:empty")}
              </p>
            ) : (
              metrics.statusCounts.map((s) => (
                <BarRow
                  key={s.status}
                  label={s.columnName ?? s.status}
                  count={s.count}
                  max={maxStatusCount}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("metrics:byPriority")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.priorityCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("metrics:empty")}
              </p>
            ) : (
              metrics.priorityCounts.map((p) => (
                <BarRow
                  key={p.priority}
                  label={getPriorityLabel(p.priority)}
                  count={p.count}
                  max={maxPriorityCount}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("metrics:workload")}</CardTitle>
          <CardDescription>{t("metrics:workloadDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.workload.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("metrics:empty")}
            </p>
          ) : (
            metrics.workload.map((w) => (
              <div
                key={w.userId ?? "unassigned"}
                className="flex items-center gap-3"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={w.userImage ?? ""} alt={w.userName ?? ""} />
                  <AvatarFallback className="text-xs">
                    {w.userName
                      ? getInitials(w.userName)
                      : t("metrics:unassigned").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {w.userName ?? t("metrics:unassigned")}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {t("metrics:openOfTotal", {
                        open: w.openCount,
                        total: w.totalCount,
                      })}
                    </span>
                  </div>
                  <Progress
                    value={
                      maxWorkloadCount > 0
                        ? Math.round((w.totalCount / maxWorkloadCount) * 100)
                        : 0
                    }
                    className="h-2"
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
