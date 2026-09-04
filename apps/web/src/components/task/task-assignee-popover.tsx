import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutNumber } from "@/components/ui/shortcut-number";
import { useAddTaskAssignee } from "@/hooks/mutations/task/use-add-task-assignee";
import { useRemoveTaskAssignee } from "@/hooks/mutations/task/use-remove-task-assignee";
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

  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { canAssignTasks } = useWorkspacePermission();
  const canAssign = canAssignTasks();

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
        ) : (
          <div
            className="w-[16px] h-[16px] rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
            title={t("tasks:popover.assignee.unassigned")}
          >
            <span className="text-[8px] font-medium">?</span>
          </div>
        )}
        <span className="text-xs font-semibold truncate max-w-[100px]">
          {task.assignees && task.assignees.length > 1
            ? `${task.assignees.length}`
            : task.assignees && task.assignees.length === 1
              ? task.assignees[0].name
              : task.assigneeName || t("tasks:popover.assignee.unassigned")}
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
          ) : (
            <div
              className="w-[16px] h-[16px] rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
              title={t("tasks:popover.assignee.unassigned")}
            >
              <span className="text-[8px] font-medium">?</span>
            </div>
          )}
          <span className="text-xs font-semibold truncate max-w-[100px]">
            {task.assignees && task.assignees.length > 1
              ? `${task.assignees.length}`
              : task.assignees && task.assignees.length === 1
                ? task.assignees[0].name
                : task.assigneeName || t("tasks:popover.assignee.unassigned")}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
