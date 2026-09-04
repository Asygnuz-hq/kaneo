import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteRecurringTask from "@/fetchers/recurring-task/delete-recurring-task";

export function useDeleteRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      deleteRecurringTask(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["recurring-tasks", variables.projectId],
      });
    },
  });
}
