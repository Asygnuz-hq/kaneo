import { useMutation, useQueryClient } from "@tanstack/react-query";
import removeTaskExternalAssignee from "@/fetchers/task/remove-task-external-assignee";

export function useRemoveTaskExternalAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      externalContactId,
    }: {
      taskId: string;
      externalContactId: string;
      projectId: string;
    }) => removeTaskExternalAssignee(taskId, externalContactId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });
}
