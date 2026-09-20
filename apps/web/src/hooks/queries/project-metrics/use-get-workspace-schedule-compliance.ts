import { useQuery } from "@tanstack/react-query";
import getWorkspaceScheduleCompliance from "@/fetchers/project-metrics/get-workspace-schedule-compliance";

export function useGetWorkspaceScheduleCompliance(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace-schedule-compliance", workspaceId],
    queryFn: () => getWorkspaceScheduleCompliance(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}
