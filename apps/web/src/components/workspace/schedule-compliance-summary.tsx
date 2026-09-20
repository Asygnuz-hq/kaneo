import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ScheduleComplianceSummary({
  totalMeasured,
  onTimePercentage,
  averageDeviationDays,
}: {
  totalMeasured: number;
  onTimePercentage: number | null;
  averageDeviationDays: number | null;
}) {
  const { t } = useTranslation();

  const isLate = (averageDeviationDays ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("metrics:scheduleCompliance.title")}
        </CardTitle>
        <CardDescription>
          {t("metrics:scheduleCompliance.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalMeasured === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("metrics:scheduleCompliance.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {onTimePercentage}%
              </p>
              <p className="text-xs text-muted-foreground">
                {t("metrics:scheduleCompliance.onTime", {
                  count: totalMeasured,
                })}
              </p>
            </div>
            <div>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  isLate && "text-destructive",
                )}
              >
                {averageDeviationDays !== null && averageDeviationDays > 0
                  ? "+"
                  : ""}
                {averageDeviationDays}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("metrics:scheduleCompliance.avgDeviation")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
