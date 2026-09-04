import { useMutation, useQueryClient } from "@tanstack/react-query";
import linkTaskToGoal from "@/fetchers/goal/link-task-to-goal";

export function useLinkTaskToGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      taskId,
    }: {
      goalId: string;
      taskId: string;
      projectId: string;
    }) => linkTaskToGoal(goalId, taskId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["goal-tasks", variables.goalId],
      });
      queryClient.invalidateQueries({
        queryKey: ["goals", variables.projectId],
      });
    },
  });
}
