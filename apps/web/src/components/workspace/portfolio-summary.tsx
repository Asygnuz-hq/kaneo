import { differenceInCalendarDays, startOfToday } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  FolderKanban,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import CircularProgress from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";

type ProjectStatistics = {
  completionPercentage: number;
  totalTasks: number;
  dueDate: string | Date | null;
};

type PortfolioProject = {
  id: string;
  statistics: ProjectStatistics | null;
};

function isOverdue(statistics: ProjectStatistics) {
  if (!statistics.dueDate || statistics.completionPercentage >= 100) {
    return false;
  }
  return new Date(statistics.dueDate) < startOfToday();
}

function isDueThisWeek(statistics: ProjectStatistics) {
  if (!statistics.dueDate || statistics.completionPercentage >= 100) {
    return false;
  }
  const days = differenceInCalendarDays(
    new Date(statistics.dueDate),
    startOfToday(),
  );
  return days >= 0 && days <= 7;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          tone === "warning"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums leading-none",
            tone === "warning" && value > 0 && "text-destructive",
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

export default function PortfolioSummary({
  projects,
}: {
  projects: PortfolioProject[];
}) {
  const { t } = useTranslation();

  const summary = useMemo(() => {
    const withStats = projects
      .map((p) => p.statistics)
      .filter((s): s is ProjectStatistics => s !== null);

    const started = withStats.filter((s) => s.totalTasks > 0);
    const avgProgress =
      started.length > 0
        ? Math.round(
            started.reduce((sum, s) => sum + s.completionPercentage, 0) /
              started.length,
          )
        : 0;

    const overdueCount = withStats.filter(isOverdue).length;
    const dueThisWeekCount = withStats.filter(isDueThisWeek).length;

    const notStarted = withStats.filter((s) => s.totalTasks === 0).length;
    const complete = withStats.filter(
      (s) => s.completionPercentage === 100,
    ).length;
    const inProgress = withStats.length - notStarted - complete;

    return {
      total: projects.length,
      avgProgress,
      overdueCount,
      dueThisWeekCount,
      notStarted,
      inProgress,
      complete,
    };
  }, [projects]);

  const distribution = [
    {
      key: "notStarted",
      count: summary.notStarted,
      className: "bg-muted-foreground/40",
    },
    { key: "inProgress", count: summary.inProgress, className: "bg-primary" },
    {
      key: "complete",
      count: summary.complete,
      className: "bg-success-foreground",
    },
  ] as const;

  const distributionTotal = distribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={FolderKanban}
          label={t("workspace:projects.portfolio.activeProjects")}
          value={summary.total}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("workspace:projects.portfolio.overdue")}
          value={summary.overdueCount}
          tone="warning"
        />
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
          <CircularProgress
            completed={summary.avgProgress}
            total={100}
            size={36}
            strokeWidth={4}
          />
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {summary.avgProgress}%
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {t("workspace:projects.portfolio.avgProgress")}
            </p>
          </div>
        </div>
        <KpiCard
          icon={CalendarClock}
          label={t("workspace:projects.portfolio.dueThisWeek")}
          value={summary.dueThisWeekCount}
        />
      </div>

      {distributionTotal > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              {t("workspace:projects.portfolio.distributionTitle")}
            </p>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {distribution.map(
              (segment) =>
                segment.count > 0 && (
                  <div
                    key={segment.key}
                    className={segment.className}
                    style={{
                      width: `${(segment.count / distributionTotal) * 100}%`,
                    }}
                  />
                ),
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {distribution.map((segment) => (
              <div
                key={segment.key}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className={cn("h-2 w-2 rounded-full", segment.className)}
                />
                {t(`workspace:projects.portfolio.${segment.key}`)}
                <span className="tabular-nums">({segment.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
