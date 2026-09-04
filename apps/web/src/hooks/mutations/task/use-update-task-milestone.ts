import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskMilestone from "@/fetchers/task/update-task-milestone";

export function useUpdateTaskMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      isMilestone,
    }: {
      taskId: string;
      isMilestone: boolean;
      projectId: string;
    }) => updateTaskMilestone(taskId, isMilestone),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
    },
  });
}
