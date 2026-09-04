import { useQuery } from "@tanstack/react-query";
import listAvailableTasks from "@/fetchers/goal/list-available-tasks";

export function useGetAvailableTasks(projectId: string) {
  return useQuery({
    queryKey: ["goal-available-tasks", projectId],
    queryFn: () => listAvailableTasks(projectId),
    enabled: !!projectId,
  });
}
