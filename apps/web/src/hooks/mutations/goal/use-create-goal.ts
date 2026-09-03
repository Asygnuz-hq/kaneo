import { useMutation, useQueryClient } from "@tanstack/react-query";
import createGoal from "@/fetchers/goal/create-goal";

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGoal,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["goals", variables.projectId],
      });
    },
  });
}
