import { useQuery } from "@tanstack/react-query";
import getWorkspaceForecast from "@/fetchers/project-metrics/get-workspace-forecast";

export function useGetWorkspaceForecast(workspaceId: string, days?: number) {
  return useQuery({
    queryKey: ["workspace-forecast", workspaceId, days],
    queryFn: () => getWorkspaceForecast(workspaceId, days),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}
