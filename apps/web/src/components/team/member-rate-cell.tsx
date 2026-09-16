import { useState } from "react";
import { useTranslation } from "react-i18next";
import useUpdateMemberRate from "@/hooks/mutations/workspace/use-update-member-rate";
import { useGetWorkspaceMemberRates } from "@/hooks/queries/workspace/use-get-workspace-member-rates";
import { toast } from "@/lib/toast";
import { Input } from "../ui/input";

type RateField = "hourlyRateCents" | "billRateCents";

type Props = {
  workspaceId: string;
  userId: string;
  canEdit: boolean;
  field: RateField;
};

// Fetches the whole workspace's rates once (react-query dedupes/caches this
// across every row's instance of this component) and picks out this one
// member's value, rather than each row firing its own request.
export default function MemberRateCell({
  workspaceId,
  userId,
  canEdit,
  field,
}: Props) {
  const { t } = useTranslation();
  const { data: rates } = useGetWorkspaceMemberRates(workspaceId);
  const { mutateAsync: updateRate, isPending } = useUpdateMemberRate();
  const [draft, setDraft] = useState<string | null>(null);

  const currentCents = rates?.find((m) => m.id === userId)?.[field] ?? null;

  if (!canEdit) {
    return (
      <span className="text-sm text-muted-foreground tabular-nums">
        {currentCents !== null
          ? t("team:membersTable.rateValue", {
              amount: (currentCents / 100).toFixed(2),
            })
          : "—"}
      </span>
    );
  }

  const displayValue =
    draft ?? (currentCents !== null ? (currentCents / 100).toFixed(2) : "");

  const commit = async (raw: string) => {
    const trimmed = raw.trim();
    const cents =
      trimmed === "" ? null : Math.round(Number.parseFloat(trimmed) * 100);

    if (trimmed !== "" && (Number.isNaN(cents) || (cents as number) < 0)) {
      toast.error(t("team:membersTable.rateInvalid"));
      setDraft(null);
      return;
    }
    if (cents === currentCents) {
      setDraft(null);
      return;
    }

    try {
      await updateRate({ workspaceId, userId, [field]: cents });
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:membersTable.rateUpdateError"),
      );
      setDraft(null);
    }
  };

  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      placeholder={t("team:membersTable.rateEmptyPlaceholder")}
      className="h-8 w-24 text-sm tabular-nums"
      value={displayValue}
      disabled={isPending}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
