import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getInitials } from "@/lib/get-initials";

type WorkloadProject = {
  projectId: string;
  projectName: string;
  openCount: number;
  totalCount: number;
};

type WorkloadEntry = {
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  openCount: number;
  totalCount: number;
  overdueCount: number;
  byProject: WorkloadProject[];
};

export default function WorkloadSummary({
  workload,
}: {
  workload: WorkloadEntry[];
}) {
  const { t } = useTranslation();

  const maxOpenCount = Math.max(0, ...workload.map((w) => w.openCount));

  if (workload.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("metrics:crossProjectTitle")}
        </CardTitle>
        <CardDescription>
          {t("metrics:crossProjectDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {workload.map((w) => (
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
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {w.userName ?? t("metrics:unassigned")}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {w.overdueCount > 0 && (
                    <Badge variant="error" size="sm">
                      {t("metrics:overdueCount", { count: w.overdueCount })}
                    </Badge>
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    {t("metrics:openOfTotal", {
                      open: w.openCount,
                      total: w.totalCount,
                    })}
                  </span>
                </div>
              </div>
              <Progress
                value={
                  maxOpenCount > 0
                    ? Math.round((w.openCount / maxOpenCount) * 100)
                    : 0
                }
                className="h-2"
              />
              {w.byProject.length > 1 && (
                <p className="truncate text-xs text-muted-foreground">
                  {w.byProject
                    .map((p) => `${p.projectName} (${p.openCount})`)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
