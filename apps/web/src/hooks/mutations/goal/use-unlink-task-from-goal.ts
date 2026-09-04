import { useMutation, useQueryClient } from "@tanstack/react-query";
import unlinkTaskFromGoal from "@/fetchers/goal/unlink-task-from-goal";

export function useUnlinkTaskFromGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      taskId,
    }: {
      goalId: string;
      taskId: string;
      projectId: string;
    }) => unlinkTaskFromGoal(goalId, taskId),
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
