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
import { getInitials } from "@/lib/get-initials";

type UpcomingPerson = {
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  taskCount: number;
  tasks: { id: string; title: string; projectName: string }[];
};

export default function UpcomingWorkloadSummary({
  people,
  days,
}: {
  people: UpcomingPerson[];
  days: number;
}) {
  const { t } = useTranslation();

  const maxCount = Math.max(0, ...people.map((p) => p.taskCount));

  if (people.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("metrics:upcomingWorkload.title")}
          </CardTitle>
          <CardDescription>
            {t("metrics:upcomingWorkload.description", { days })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("metrics:upcomingWorkload.empty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("metrics:upcomingWorkload.title")}
        </CardTitle>
        <CardDescription>
          {t("metrics:upcomingWorkload.description", { days })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {people.map((p) => (
          <div
            key={p.userId ?? "unassigned"}
            className="flex items-center gap-3"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={p.userImage ?? ""} alt={p.userName ?? ""} />
              <AvatarFallback className="text-xs">
                {p.userName
                  ? getInitials(p.userName)
                  : t("metrics:unassigned").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {p.userName ?? t("metrics:unassigned")}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {t("metrics:upcomingWorkload.taskCount", {
                    count: p.taskCount,
                  })}
                </span>
              </div>
              <Progress
                value={
                  maxCount > 0 ? Math.round((p.taskCount / maxCount) * 100) : 0
                }
                className="h-2"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
