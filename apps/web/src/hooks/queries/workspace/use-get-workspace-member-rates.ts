import { useQuery } from "@tanstack/react-query";
import getWorkspaceMemberRates from "@/fetchers/workspace/get-workspace-member-rates";

export function useGetWorkspaceMemberRates(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-member-rates", workspaceId],
    queryFn: () => getWorkspaceMemberRates(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}
