import { useState } from "react";
import { useTranslation } from "react-i18next";
import useUpdateProjectBudget from "@/hooks/mutations/project/use-update-project-budget";
import { useGetProjectBudget } from "@/hooks/queries/project-metrics/use-get-project-budget";
import { toast } from "@/lib/toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Progress, ProgressIndicator, ProgressTrack } from "../ui/progress";

type Props = {
  projectId: string;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function ProjectBudgetCard({ projectId }: Props) {
  const { t } = useTranslation();
  const { data: budget, isLoading } = useGetProjectBudget(projectId);
  const { mutateAsync: updateBudget, isPending } = useUpdateProjectBudget();
  const [isEditing, setIsEditing] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState("USD");

  if (isLoading || !budget) return null;

  const startEditing = () => {
    setAmountDraft(
      budget.budgetCents !== null ? (budget.budgetCents / 100).toFixed(2) : "",
    );
    setCurrencyDraft(budget.currency);
    setIsEditing(true);
  };

  const save = async () => {
    const trimmed = amountDraft.trim();
    const budgetCents =
      trimmed === "" ? null : Math.round(Number.parseFloat(trimmed) * 100);

    if (
      trimmed !== "" &&
      (Number.isNaN(budgetCents) || (budgetCents as number) < 0)
    ) {
      toast.error(t("metrics:budget.invalidAmount"));
      return;
    }

    try {
      await updateBudget({
        id: projectId,
        budgetCents,
        currency: currencyDraft.trim().toUpperCase() || "USD",
      });
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("metrics:budget.saveError"),
      );
    }
  };

  if (budget.budgetCents === null && !isEditing) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
            {t("metrics:budget.notSet")}
          </p>
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={startEditing}
          >
            {t("metrics:budget.addBudget")}
          </button>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("metrics:budget.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor="budget-amount"
              className="text-xs text-muted-foreground"
            >
              {t("metrics:budget.amountLabel")}
            </label>
            <Input
              id="budget-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="h-8"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              autoFocus
            />
          </div>
          <div className="w-20">
            <label
              htmlFor="budget-currency"
              className="text-xs text-muted-foreground"
            >
              {t("metrics:budget.currencyLabel")}
            </label>
            <Input
              id="budget-currency"
              className="h-8 uppercase"
              maxLength={3}
              value={currencyDraft}
              onChange={(e) => setCurrencyDraft(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={isPending}
            className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            onClick={save}
          >
            {t("common:actions.save")}
          </button>
          <button
            type="button"
            className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent"
            onClick={() => setIsEditing(false)}
          >
            {t("common:actions.cancel")}
          </button>
        </CardContent>
      </Card>
    );
  }

  const budgetCents = budget.budgetCents as number;
  const spentPct = Math.min(
    100,
    Math.round((budget.spentCents / budgetCents) * 100),
  );
  const isOverBudget = budget.spentCents > budgetCents;
  const projectedOverBudget =
    budget.projectedTotalCents !== null &&
    budget.projectedTotalCents > budgetCents;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            {t("metrics:budget.title")}
          </CardTitle>
          <CardDescription>{t("metrics:budget.description")}</CardDescription>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          onClick={startEditing}
        >
          {t("metrics:budget.edit")}
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className={isOverBudget ? "font-medium text-destructive" : ""}>
            {formatMoney(budget.spentCents, budget.currency)}
          </span>
          <span className="text-muted-foreground">
            {t("metrics:budget.ofBudget", {
              amount: formatMoney(budgetCents, budget.currency),
            })}
          </span>
        </div>
        <Progress value={spentPct} className="gap-0">
          <ProgressTrack className="h-2">
            <ProgressIndicator
              className={isOverBudget ? "bg-destructive" : undefined}
            />
          </ProgressTrack>
        </Progress>
        {budget.projectedTotalCents !== null && (
          <p
            className={
              projectedOverBudget
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {t("metrics:budget.projected", {
              amount: formatMoney(budget.projectedTotalCents, budget.currency),
            })}
          </p>
        )}
        {budget.unratedBillableSeconds > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("metrics:budget.unratedWarning", {
              hours: Math.round(budget.unratedBillableSeconds / 3600),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
