import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateGoal, {
  type UpdateGoalRequest,
} from "@/fetchers/goal/update-goal";

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId: _projectId,
      ...request
    }: UpdateGoalRequest & { projectId: string }) => updateGoal(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["goals", variables.projectId],
      });
    },
  });
}
