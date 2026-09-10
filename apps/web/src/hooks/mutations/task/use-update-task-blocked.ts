import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskBlocked from "@/fetchers/task/update-task-blocked";

export function useUpdateTaskBlocked() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      isBlocked,
    }: {
      taskId: string;
      isBlocked: boolean;
      projectId: string;
    }) => updateTaskBlocked(taskId, isBlocked),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.taskId],
      });
    },
  });
}
