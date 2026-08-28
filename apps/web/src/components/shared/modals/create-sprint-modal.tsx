import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateSprint } from "@/hooks/mutations/sprint/use-create-sprint";
import { toast } from "@/lib/toast";

type CreateSprintModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
};

export default function CreateSprintModal({
  open,
  onClose,
  projectId,
}: CreateSprintModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const { mutateAsync: createSprint, isPending } = useCreateSprint();

  const handleClose = () => {
    setName("");
    setGoal("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createSprint({
        projectId,
        name: name.trim(),
        goal: goal.trim() || undefined,
      });
      toast.success(t("tasks:sprint.createSuccess"));
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:sprint.createError"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tasks:sprint.createTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("tasks:sprint.createTitle")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder={t("tasks:sprint.namePlaceholder")}
            required
          />
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={t("tasks:sprint.goalPlaceholder")}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || isPending}
            >
              {t("tasks:sprint.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
