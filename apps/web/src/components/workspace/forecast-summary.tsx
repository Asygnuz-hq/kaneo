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

type Status = "idle" | "ok" | "tight" | "overloaded" | "no-history";

type Projection = {
  velocityPerWeek: number;
  capacity: number;
  upcoming: number;
  overdue: number;
  demand: number;
  utilization: number | null;
  status: Status;
  atRisk: number;
  confidence: "low" | "medium" | "high";
};

type ForecastPerson = Projection & {
  userId: string;
  userName: string | null;
  userImage: string | null;
};

const STATUS_KEY: Record<Status, string> = {
  idle: "idle",
  ok: "ok",
  tight: "tight",
  overloaded: "overloaded",
  "no-history": "noHistory",
};

const STATUS_VARIANT: Record<Status, "success" | "warning" | "error" | "info"> =
  {
    idle: "info",
    ok: "success",
    tight: "warning",
    overloaded: "error",
    "no-history": "warning",
  };

// The bar shows demand against capacity: full at 100%, and it stops growing at
// 150% so one extreme person doesn't flatten everyone else.
function barValue(utilization: number | null) {
  if (utilization === null) return 100;
  return Math.min(100, Math.round((utilization / 1.5) * 100));
}

export default function ForecastSummary({
  team,
  people,
  unassigned,
  scheduleReliability,
  days,
}: {
  team: Projection;
  people: ForecastPerson[];
  unassigned: { upcoming: number; overdue: number };
  scheduleReliability: {
    onTimePercentage: number | null;
    averageDeviationDays: number | null;
  };
  days: number;
}) {
  const { t } = useTranslation();

  const hasUnassigned = unassigned.upcoming + unassigned.overdue > 0;
  const isEmpty = people.length === 0 && !hasUnassigned;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("metrics:forecast.title")}
        </CardTitle>
        <CardDescription>
          {t("metrics:forecast.description", { days })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            {t("metrics:forecast.empty")}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">
                  {t("metrics:forecast.team")}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {t("metrics:forecast.summary", {
                    demand: team.demand,
                    capacity: team.capacity,
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {team.atRisk > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("metrics:forecast.atRisk", { count: team.atRisk })}
                  </span>
                )}
                <Badge variant={STATUS_VARIANT[team.status]}>
                  {t(`metrics:forecast.status.${STATUS_KEY[team.status]}`)}
                </Badge>
              </div>
            </div>

            {people.map((p) => (
              <div key={p.userId} className="flex items-center gap-3">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={p.userImage ?? ""} alt={p.userName ?? ""} />
                  <AvatarFallback className="text-xs">
                    {p.userName ? getInitials(p.userName) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {p.userName ?? t("metrics:unassigned")}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.atRisk > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t("metrics:forecast.atRisk", { count: p.atRisk })}
                        </span>
                      )}
                      <Badge variant={STATUS_VARIANT[p.status]} size="sm">
                        {t(`metrics:forecast.status.${STATUS_KEY[p.status]}`)}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={barValue(p.utilization)} className="h-2" />
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {t("metrics:forecast.detail", {
                      upcoming: p.upcoming,
                      overdue: p.overdue,
                      velocity: p.velocityPerWeek,
                    })}
                    {p.confidence === "low" && (
                      <> · {t("metrics:forecast.lowConfidence")}</>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {hasUnassigned && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("metrics:forecast.unassigned", {
                  upcoming: unassigned.upcoming,
                  overdue: unassigned.overdue,
                })}
              </p>
            )}

            {scheduleReliability.onTimePercentage !== null && (
              <p className="text-xs text-muted-foreground">
                {t("metrics:forecast.reliability", {
                  percentage: Math.round(scheduleReliability.onTimePercentage),
                  days: scheduleReliability.averageDeviationDays ?? 0,
                })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
