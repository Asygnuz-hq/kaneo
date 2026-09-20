import { useQuery } from "@tanstack/react-query";
import getWorkspaceRecentlyClosed from "@/fetchers/project-metrics/get-workspace-recently-closed";

export function useGetWorkspaceRecentlyClosed(
  workspaceId: string,
  days?: number,
) {
  return useQuery({
    queryKey: ["workspace-recently-closed", workspaceId, days],
    queryFn: () => getWorkspaceRecentlyClosed(workspaceId, days),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}
