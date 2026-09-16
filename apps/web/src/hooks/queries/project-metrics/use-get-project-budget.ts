import { useQuery } from "@tanstack/react-query";
import getProjectBudget from "@/fetchers/project-metrics/get-project-budget";

export function useGetProjectBudget(projectId: string) {
  return useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: () => getProjectBudget(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}
