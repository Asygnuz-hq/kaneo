import { Check, UserRoundPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutNumber } from "@/components/ui/shortcut-number";
import useCreateExternalContact from "@/hooks/mutations/external-contact/use-create-external-contact";
import { useAddTaskAssignee } from "@/hooks/mutations/task/use-add-task-assignee";
import { useAddTaskExternalAssignee } from "@/hooks/mutations/task/use-add-task-external-assignee";
import { useRemoveTaskAssignee } from "@/hooks/mutations/task/use-remove-task-assignee";
import { useRemoveTaskExternalAssignee } from "@/hooks/mutations/task/use-remove-task-external-assignee";
import { useGetExternalContacts } from "@/hooks/queries/external-contact/use-get-external-contacts";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useNumberedShortcuts } from "@/hooks/use-numbered-shortcuts";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const INITIAL_VISIBLE_USERS = 40;
const VISIBLE_USERS_STEP = 40;

type TaskAssigneePopoverProps = {
  task: Task;
  workspaceId: string;
};

export default function TaskAssigneePopover({
  task,
  workspaceId,
}: TaskAssigneePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [visibleUsersCount, setVisibleUsersCount] = useState(
    INITIAL_VISIBLE_USERS,
  );

  const { mutateAsync: addTaskAssignee } = useAddTaskAssignee();
  const { mutateAsync: removeTaskAssignee } = useRemoveTaskAssignee();
  const { mutateAsync: addTaskExternalAssignee } = useAddTaskExternalAssignee();
  const { mutateAsync: removeTaskExternalAssignee } =
    useRemoveTaskExternalAssignee();
  const { mutateAsync: createExternalContact, isPending: isCreatingContact } =
    useCreateExternalContact();

  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: externalContacts } = useGetExternalContacts(workspaceId);
  const { canAssignTasks, canManageWorkspace } = useWorkspacePermission();
  const canAssign = canAssignTasks();
  const canCreateExternalContact = canManageWorkspace();
  const [newContactName, setNewContactName] = useState("");

  const usersOptions = useMemo(() => {
    return workspaceUsers?.members?.map((member) => ({
      label: member?.user?.name ?? member.userId,
      value: member.userId,
      image: member?.user?.image ?? "",
      name: member?.user?.name ?? "",
    }));
  }, [workspaceUsers]);

  const handleAssigneeChange = useCallback(
    async (newUserId: string) => {
      try {
        const isAssigned = task.assignees?.some((a) => a.id === newUserId);
        if (isAssigned) {
          await removeTaskAssignee({
            taskId: task.id,
            userId: newUserId,
            projectId: task.projectId,
          });
        } else {
          await addTaskAssignee({
            taskId: task.id,
            userId: newUserId,
            projectId: task.projectId,
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.assignee.updateError"),
        );
      }
    },
    [t, task, addTaskAssignee, removeTaskAssignee],
  );

  const handleExternalContactChange = useCallback(
    async (externalContactId: string) => {
      try {
        const isAssigned = task.externalAssignees?.some(
          (a) => a.id === externalContactId,
        );
        if (isAssigned) {
          await removeTaskExternalAssignee({
            taskId: task.id,
            externalContactId,
            projectId: task.projectId,
          });
        } else {
          await addTaskExternalAssignee({
            taskId: task.id,
            externalContactId,
            projectId: task.projectId,
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.assignee.updateError"),
        );
      }
    },
    [t, task, addTaskExternalAssignee, removeTaskExternalAssignee],
  );

  const handleCreateExternalContact = useCallback(async () => {
    const name = newContactName.trim();
    if (!name) return;

    try {
      const contact = await createExternalContact({ workspaceId, name });
      setNewContactName("");
      await addTaskExternalAssignee({
        taskId: task.id,
        externalContactId: contact.id,
        projectId: task.projectId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.assignee.createExternalContactError"),
      );
    }
  }, [
    newContactName,
    createExternalContact,
    workspaceId,
    task,
    addTaskExternalAssignee,
    t,
  ]);

  const shortcutOptions = useMemo(() => {
    const userOptions = (usersOptions || []).slice(0, 9).map((user) => ({
      onSelect: () => handleAssigneeChange(user.value),
    }));
    return userOptions;
  }, [usersOptions, handleAssigneeChange]);

  const visibleUsersOptions = useMemo(() => {
    return usersOptions?.slice(0, visibleUsersCount) ?? [];
  }, [usersOptions, visibleUsersCount]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setVisibleUsersCount(INITIAL_VISIBLE_USERS);
    }
  }, []);

  const handleListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const nearBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight < 48;

      if (!nearBottom) return;

      setVisibleUsersCount((current) => {
        const totalUsers = usersOptions?.length ?? current;
        return Math.min(current + VISIBLE_USERS_STEP, totalUsers);
      });
    },
    [usersOptions?.length],
  );

  useNumberedShortcuts(open, shortcutOptions);

  const externalAssignees = task.externalAssignees ?? [];
  const totalAssigneeCount =
    (task.assignees?.length ?? 0) + externalAssignees.length;
  const soleAssigneeName =
    totalAssigneeCount === 1
      ? (task.assignees?.[0]?.name ?? externalAssignees[0]?.name)
      : null;

  const externalAssigneeChips = externalAssignees.length > 0 && (
    <div className="flex -space-x-1">
      {externalAssignees.map((a) => (
        <Avatar
          key={a.id}
          className="h-[16px] w-[16px] border border-dashed border-muted-foreground/60"
          title={a.name}
        >
          <AvatarFallback className="text-[9px] font-medium bg-muted h-[16px] w-[16px]">
            {getInitials(a.name)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );

  if (!canAssign) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="justify-start h-7 px-1.5 gap-1.5 pointer-events-none"
      >
        {task.assignees && task.assignees.length > 0 ? (
          <div className="flex -space-x-1">
            {task.assignees.map((a) => (
              <Avatar
                key={a.id}
                className="h-[16px] w-[16px] border border-background"
              >
                <AvatarImage src={a.image ?? ""} alt={a.name ?? ""} />
                <AvatarFallback className="text-[9px] font-medium border border-border/30 h-[16px] w-[16px]">
                  {getInitials(a.name || "")}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        ) : task.userId ? (
          <Avatar className="h-[16px] w-[16px]">
            <AvatarImage
              src={task.assigneeImage ?? ""}
              alt={task.assigneeName || ""}
            />
            <AvatarFallback className="text-[9px] font-medium border border-border/30 shrink-0 h-[16px] w-[16px]">
              {getInitials(task.assigneeName)}
            </AvatarFallback>
          </Avatar>
        ) : externalAssigneeChips ? null : (
          <div
            className="w-[16px] h-[16px] rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
            title={t("tasks:popover.assignee.unassigned")}
          >
            <span className="text-[8px] font-medium">?</span>
          </div>
        )}
        {externalAssigneeChips}
        <span className="text-xs font-semibold truncate max-w-[100px]">
          {totalAssigneeCount > 1
            ? `${totalAssigneeCount}`
            : soleAssigneeName ||
              task.assigneeName ||
              t("tasks:popover.assignee.unassigned")}
        </span>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start h-7 px-1.5 gap-1.5"
        >
          {task.assignees && task.assignees.length > 0 ? (
            <div className="flex -space-x-1">
              {task.assignees.map((a) => (
                <Avatar
                  key={a.id}
                  className="h-[16px] w-[16px] border border-background"
                >
                  <AvatarImage src={a.image ?? ""} alt={a.name ?? ""} />
                  <AvatarFallback className="text-[9px] font-medium border border-border/30 h-[16px] w-[16px]">
                    {getInitials(a.name || "")}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : task.userId ? (
            <Avatar className="h-[16px] w-[16px]">
              <AvatarImage
                src={task.assigneeImage ?? ""}
                alt={task.assigneeName || ""}
              />
              <AvatarFallback className="text-[9px] font-medium border border-border/30 shrink-0 h-[16px] w-[16px]">
                {getInitials(task.assigneeName)}
              </AvatarFallback>
            </Avatar>
          ) : externalAssigneeChips ? null : (
            <div
              className="w-[16px] h-[16px] rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
              title={t("tasks:popover.assignee.unassigned")}
            >
              <span className="text-[8px] font-medium">?</span>
            </div>
          )}
          {externalAssigneeChips}
          <span className="text-xs font-semibold truncate max-w-[100px]">
            {totalAssigneeCount > 1
              ? `${totalAssigneeCount}`
              : soleAssigneeName ||
                task.assigneeName ||
                t("tasks:popover.assignee.unassigned")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div
          className="max-h-80 space-y-1 overflow-y-auto p-1"
          onScroll={handleListScroll}
        >
          {visibleUsersOptions.map((user, index) => {
            const isAssigned =
              task.assignees?.some((a) => a.id === user.value) ||
              task.userId === user.value;
            return (
              <Button
                key={user.value}
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8 px-2"
                onClick={() => handleAssigneeChange(user.value)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
                  <AvatarFallback className="text-xs font-medium border border-border/30">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{user.label}</span>
                {isAssigned ? (
                  <Check className="ml-auto h-4 w-4 shrink-0" />
                ) : index < 9 ? (
                  <ShortcutNumber number={index + 1} />
                ) : null}
              </Button>
            );
          })}
          {(externalContacts && externalContacts.length > 0) ||
          canCreateExternalContact ? (
            <>
              <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("tasks:popover.assignee.externalContacts")}
              </div>
              {externalContacts?.map((contact) => {
                const isAssigned = externalAssignees.some(
                  (a) => a.id === contact.id,
                );
                return (
                  <Button
                    key={contact.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-8 px-2"
                    onClick={() => handleExternalContactChange(contact.id)}
                  >
                    <Avatar className="h-6 w-6 border border-dashed border-muted-foreground/60">
                      <AvatarFallback className="text-xs font-medium bg-muted">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{contact.name}</span>
                    {isAssigned ? (
                      <Check className="ml-auto h-4 w-4 shrink-0" />
                    ) : null}
                  </Button>
                );
              })}
              {canCreateExternalContact ? (
                <div className="flex items-center gap-1 px-1 pt-1">
                  <Input
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateExternalContact();
                      }
                    }}
                    placeholder={t(
                      "tasks:popover.assignee.addExternalContactPlaceholder",
                    )}
                    className="h-8 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={!newContactName.trim() || isCreatingContact}
                    onClick={handleCreateExternalContact}
                  >
                    <UserRoundPlus className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
