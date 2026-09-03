import { useQuery } from "@tanstack/react-query";
import listAutomationRules from "@/fetchers/automation/list-automation-rules";

export function useGetAutomationRules(projectId: string) {
  return useQuery({
    queryKey: ["automation-rules", projectId],
    queryFn: () => listAutomationRules(projectId),
    enabled: !!projectId,
  });
}
