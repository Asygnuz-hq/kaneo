import { useQuery } from "@tanstack/react-query";
import getProjectMetrics from "@/fetchers/project-metrics/get-project-metrics";

export function useGetProjectMetrics(projectId: string) {
  return useQuery({
    queryKey: ["project-metrics", projectId],
    queryFn: () => getProjectMetrics(projectId),
    enabled: !!projectId,
    // Task counts shift as the team works; keep this reasonably fresh
    // without refetching on every render.
    staleTime: 30_000,
  });
}
