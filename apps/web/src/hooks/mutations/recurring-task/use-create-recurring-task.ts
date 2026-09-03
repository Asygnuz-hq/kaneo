import { useMutation, useQueryClient } from "@tanstack/react-query";
import createRecurringTask from "@/fetchers/recurring-task/create-recurring-task";

export function useCreateRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRecurringTask,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["recurring-tasks", variables.projectId],
      });
    },
  });
}
