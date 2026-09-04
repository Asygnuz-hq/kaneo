import { useMutation, useQueryClient } from "@tanstack/react-query";
import addTaskExternalAssignee from "@/fetchers/task/add-task-external-assignee";

export function useAddTaskExternalAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      externalContactId,
    }: {
      taskId: string;
      externalContactId: string;
      projectId: string;
    }) => addTaskExternalAssignee(taskId, externalContactId),
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
