import { useQuery } from "@tanstack/react-query";
import listGoals from "@/fetchers/goal/list-goals";

export function useGetGoals(projectId: string) {
  return useQuery({
    queryKey: ["goals", projectId],
    queryFn: () => listGoals(projectId),
    enabled: !!projectId,
  });
}
