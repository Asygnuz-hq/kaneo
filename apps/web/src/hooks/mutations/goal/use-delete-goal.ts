import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteGoal from "@/fetchers/goal/delete-goal";

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => deleteGoal(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["goals", variables.projectId],
      });
    },
  });
}
