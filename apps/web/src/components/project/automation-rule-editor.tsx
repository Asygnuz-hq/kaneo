import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateAutomationRule } from "@/hooks/mutations/automation/use-create-automation-rule";
import { useDeleteAutomationRule } from "@/hooks/mutations/automation/use-delete-automation-rule";
import { useUpdateAutomationRule } from "@/hooks/mutations/automation/use-update-automation-rule";
import { useGetAutomationRules } from "@/hooks/queries/automation/use-get-automation-rules";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { toast } from "@/lib/toast";

const TRIGGER_TYPES = [
  "task.created",
  "task.status_changed",
  "task.priority_changed",
  "task.assignee_changed",
  "task.label_assigned",
] as const;

const ACTION_TYPES = [
  "move_to_column",
  "set_priority",
  "assign_user",
  "add_label",
] as const;

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"];

const ANY_VALUE = "__any__";

type AutomationRule = {
  id: string;
  name: string;
  isActive: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
};

type FormState = {
  name: string;
  triggerType: string;
  toStatus: string;
  toPriority: string;
  triggerLabelId: string;
  actionType: string;
  columnId: string;
  priority: string;
  userId: string;
  actionLabelId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  triggerType: "task.created",
  toStatus: "",
  toPriority: "",
  triggerLabelId: "",
  actionType: "set_priority",
  columnId: "",
  priority: "",
  userId: "",
  actionLabelId: "",
};

function ruleToFormState(rule: AutomationRule): FormState {
  return {
    name: rule.name,
    triggerType: rule.triggerType,
    toStatus: (rule.triggerConfig.toStatus as string) ?? "",
    toPriority: (rule.triggerConfig.toPriority as string) ?? "",
    triggerLabelId: (rule.triggerConfig.labelId as string) ?? "",
    actionType: rule.actionType,
    columnId: (rule.actionConfig.columnId as string) ?? "",
    priority: (rule.actionConfig.priority as string) ?? "",
    userId: (rule.actionConfig.userId as string) ?? "",
    actionLabelId: (rule.actionConfig.labelId as string) ?? "",
  };
}

function buildTriggerConfig(form: FormState): Record<string, unknown> {
  switch (form.triggerType) {
    case "task.status_changed":
      return form.toStatus ? { toStatus: form.toStatus } : {};
    case "task.priority_changed":
      return form.toPriority ? { toPriority: form.toPriority } : {};
    case "task.label_assigned":
      return form.triggerLabelId ? { labelId: form.triggerLabelId } : {};
    default:
      return {};
  }
}

function buildActionConfig(form: FormState): Record<string, unknown> {
  switch (form.actionType) {
    case "move_to_column":
      return { columnId: form.columnId };
    case "set_priority":
      return { priority: form.priority };
    case "assign_user":
      return { userId: form.userId };
    case "add_label":
      return { labelId: form.actionLabelId };
    default:
      return {};
  }
}

type AutomationRuleEditorProps = {
  projectId: string;
  workspaceId: string;
};

export default function AutomationRuleEditor({
  projectId,
  workspaceId,
}: AutomationRuleEditorProps) {
  const { t } = useTranslation();
  const { data: rules, isLoading: rulesLoading } =
    useGetAutomationRules(projectId);
  const { data: columns, isLoading: columnsLoading } = useGetColumns(projectId);
  const { data: labels } = useGetLabelsByWorkspace(workspaceId);
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { mutateAsync: createRule, isPending: isCreating } =
    useCreateAutomationRule();
  const { mutateAsync: updateRule, isPending: isUpdating } =
    useUpdateAutomationRule();
  const { mutateAsync: deleteRule } = useDeleteAutomationRule();

  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);

  const members = workspaceUsers?.members ?? [];

  function openCreateForm() {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEditForm(rule: AutomationRule) {
    setEditingRule(rule);
    setForm(ruleToFormState(rule));
    setIsFormOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error(t("settings:automationRules.nameRequired"));
      return;
    }

    const triggerConfig = buildTriggerConfig(form);
    const actionConfig = buildActionConfig(form);

    try {
      if (editingRule) {
        await updateRule({
          id: editingRule.id,
          projectId,
          name: form.name,
          triggerType: form.triggerType,
          triggerConfig,
          actionType: form.actionType,
          actionConfig,
        });
        toast.success(t("settings:automationRules.updateSuccess"));
      } else {
        await createRule({
          projectId,
          name: form.name,
          triggerType: form.triggerType,
          triggerConfig,
          actionType: form.actionType,
          actionConfig,
        });
        toast.success(t("settings:automationRules.createSuccess"));
      }
      setIsFormOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:automationRules.saveError"),
      );
    }
  }

  async function handleToggleActive(rule: AutomationRule, isActive: boolean) {
    try {
      await updateRule({ id: rule.id, projectId, isActive });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:automationRules.saveError"),
      );
    }
  }

  async function handleDelete() {
    if (!ruleToDelete) return;
    try {
      await deleteRule({ id: ruleToDelete.id, projectId });
      toast.success(t("settings:automationRules.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:automationRules.deleteError"),
      );
    } finally {
      setRuleToDelete(null);
    }
  }

  function describeTrigger(rule: AutomationRule) {
    const base = t(`settings:automationRules.triggers.${rule.triggerType}`);
    if (
      rule.triggerType === "task.status_changed" &&
      rule.triggerConfig.toStatus
    ) {
      const column = columns?.find(
        (c) => c.slug === rule.triggerConfig.toStatus,
      );
      return `${base}: ${column?.name ?? rule.triggerConfig.toStatus}`;
    }
    if (
      rule.triggerType === "task.priority_changed" &&
      rule.triggerConfig.toPriority
    ) {
      return `${base}: ${getPriorityLabel(rule.triggerConfig.toPriority as string)}`;
    }
    if (
      rule.triggerType === "task.label_assigned" &&
      rule.triggerConfig.labelId
    ) {
      const label = labels?.find((l) => l.id === rule.triggerConfig.labelId);
      return `${base}: ${label?.name ?? rule.triggerConfig.labelId}`;
    }
    return base;
  }

  function describeAction(rule: AutomationRule) {
    const base = t(`settings:automationRules.actions.${rule.actionType}`);
    if (rule.actionType === "move_to_column") {
      const column = columns?.find((c) => c.id === rule.actionConfig.columnId);
      return `${base}: ${column?.name ?? rule.actionConfig.columnId}`;
    }
    if (rule.actionType === "set_priority") {
      return `${base}: ${getPriorityLabel(rule.actionConfig.priority as string)}`;
    }
    if (rule.actionType === "assign_user") {
      const member = members.find((m) => m.userId === rule.actionConfig.userId);
      return `${base}: ${member?.user?.name ?? rule.actionConfig.userId}`;
    }
    if (rule.actionType === "add_label") {
      const label = labels?.find((l) => l.id === rule.actionConfig.labelId);
      return `${base}: ${label?.name ?? rule.actionConfig.labelId}`;
    }
    return base;
  }

  if (rulesLoading || columnsLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:automationRules.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("settings:automationRules.description")}
        </p>
        <Button size="sm" onClick={openCreateForm}>
          {t("settings:automationRules.createRule")}
        </Button>
      </div>

      {!rules || rules.length === 0 ? (
        <Empty className="border border-dashed border-border rounded-md py-8">
          <EmptyHeader>
            <EmptyMedia />
            <EmptyTitle>{t("settings:automationRules.empty")}</EmptyTitle>
            <EmptyDescription>
              {t("settings:automationRules.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-4 p-3 border border-border rounded-md bg-sidebar"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{rule.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("settings:automationRules.summary", {
                    trigger: describeTrigger(rule),
                    action: describeAction(rule),
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={(checked) =>
                    handleToggleActive(rule, checked)
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditForm(rule)}
                >
                  {t("common:actions.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRuleToDelete(rule)}
                >
                  {t("common:actions.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule
                ? t("settings:automationRules.editRule")
                : t("settings:automationRules.createRule")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:automationRules.formDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings:automationRules.nameLabel")}</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("settings:automationRules.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings:automationRules.triggerLabel")}</Label>
              <Select
                value={form.triggerType}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    triggerType: value ?? f.triggerType,
                    toStatus: "",
                    toPriority: "",
                    triggerLabelId: "",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {t(`settings:automationRules.triggers.${form.triggerType}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`settings:automationRules.triggers.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.triggerType === "task.status_changed" && (
              <div className="space-y-1.5">
                <Label>{t("settings:automationRules.toStatusLabel")}</Label>
                <Select
                  value={form.toStatus || ANY_VALUE}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      toStatus: !value || value === ANY_VALUE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {form.toStatus
                        ? (columns?.find((c) => c.slug === form.toStatus)
                            ?.name ?? form.toStatus)
                        : t("settings:automationRules.anyValue")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>
                      {t("settings:automationRules.anyValue")}
                    </SelectItem>
                    {columns?.map((column) => (
                      <SelectItem key={column.id} value={column.slug}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.triggerType === "task.priority_changed" && (
              <div className="space-y-1.5">
                <Label>{t("settings:automationRules.toPriorityLabel")}</Label>
                <Select
                  value={form.toPriority || ANY_VALUE}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      toPriority: !value || value === ANY_VALUE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {form.toPriority
                        ? getPriorityLabel(form.toPriority)
                        : t("settings:automationRules.anyValue")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>
                      {t("settings:automationRules.anyValue")}
                    </SelectItem>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {getPriorityLabel(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.triggerType === "task.label_assigned" && (
              <div className="space-y-1.5">
                <Label>{t("settings:automationRules.triggerLabelLabel")}</Label>
                <Select
                  value={form.triggerLabelId || ANY_VALUE}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      triggerLabelId:
                        !value || value === ANY_VALUE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {form.triggerLabelId
                        ? (labels?.find((l) => l.id === form.triggerLabelId)
                            ?.name ?? form.triggerLabelId)
                        : t("settings:automationRules.anyValue")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>
                      {t("settings:automationRules.anyValue")}
                    </SelectItem>
                    {labels?.map((label) => (
                      <SelectItem key={label.id} value={label.id}>
                        {label.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("settings:automationRules.actionLabel")}</Label>
              <Select
                value={form.actionType}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    actionType: value ?? f.actionType,
                    columnId: "",
                    priority: "",
                    userId: "",
                    actionLabelId: "",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {t(`settings:automationRules.actions.${form.actionType}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`settings:automationRules.actions.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.actionType === "move_to_column" && (
              <div className="space-y-1.5">
                <Label>{t("settings:automationRules.columnLabel")}</Label>
                <Select
                  value={form.columnId}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, columnId: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t(
                        "settings:automationRules.selectPlaceholder",
                      )}
                    >
                      {columns?.find((c) => c.id === form.columnId)?.name ??
                        t("settings:automationRules.selectPlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {columns?.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.actionType === "set_priority" && (
              <div className="space-y-1.5">
                <Label>{t("settings:automationRules.priorityLabel")}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, priority: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t(
                        "settings:automationRules.selectPlaceholder",
                      )}
                    >
                      {form.priority
                        ? getPriorityLabel(form.priority)
                        : t("settings:automationRules.selectPlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {getPriorityLabel(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.actionType === "assign_user" && (
              <div className="space-y-1.5">
                <Label>{t("settings:automationRules.userLabel")}</Label>
                <Select
                  value={form.userId}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, userId: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t(
                        "settings:automationRules.selectPlaceholder",
                      )}
                    >
                      {members.find((m) => m.userId === form.userId)?.user
                        ?.name ??
                        t("settings:automationRules.selectPlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.user?.name ?? member.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.actionType === "add_label" && (
              <div className="space-y-1.5">
                <Label>{t("settings:automationRules.actionLabelLabel")}</Label>
                <Select
                  value={form.actionLabelId}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, actionLabelId: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t(
                        "settings:automationRules.selectPlaceholder",
                      )}
                    >
                      {labels?.find((l) => l.id === form.actionLabelId)?.name ??
                        t("settings:automationRules.selectPlaceholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {labels?.map((label) => (
                      <SelectItem key={label.id} value={label.id}>
                        {label.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
              {t("settings:automationRules.saveRule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!ruleToDelete}
        onOpenChange={(open) => !open && setRuleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:automationRules.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:automationRules.deleteConfirmDescription", {
                name: ruleToDelete?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRuleToDelete(null)}>
              {t("common:actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("common:actions.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
