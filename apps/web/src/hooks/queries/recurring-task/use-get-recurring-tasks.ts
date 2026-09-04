import { useQuery } from "@tanstack/react-query";
import listRecurringTasks from "@/fetchers/recurring-task/list-recurring-tasks";

export function useGetRecurringTasks(projectId: string) {
  return useQuery({
    queryKey: ["recurring-tasks", projectId],
    queryFn: () => listRecurringTasks(projectId),
    enabled: !!projectId,
  });
}
