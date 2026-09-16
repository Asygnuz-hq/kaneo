import { useQuery } from "@tanstack/react-query";
import getWorkspaceWorkload from "@/fetchers/project-metrics/get-workspace-workload";

export function useGetWorkspaceWorkload(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-workload", workspaceId],
    queryFn: () => getWorkspaceWorkload(workspaceId),
    enabled: !!workspaceId,
    // Same staleness budget as the per-project metrics view: fresh enough
    // to trust, without refetching on every render.
    staleTime: 30_000,
  });
}
