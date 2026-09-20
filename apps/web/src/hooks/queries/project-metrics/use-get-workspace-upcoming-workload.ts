import { useQuery } from "@tanstack/react-query";
import getWorkspaceUpcomingWorkload from "@/fetchers/project-metrics/get-workspace-upcoming-workload";

export function useGetWorkspaceUpcomingWorkload(
  workspaceId: string,
  days?: number,
) {
  return useQuery({
    queryKey: ["workspace-upcoming-workload", workspaceId, days],
    queryFn: () => getWorkspaceUpcomingWorkload(workspaceId, days),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}
