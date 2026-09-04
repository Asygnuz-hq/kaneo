import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateRecurringTask, {
  type UpdateRecurringTaskRequest,
} from "@/fetchers/recurring-task/update-recurring-task";

export function useUpdateRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId: _projectId,
      ...request
    }: UpdateRecurringTaskRequest & { projectId: string }) =>
      updateRecurringTask(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["recurring-tasks", variables.projectId],
      });
    },
  });
}
