import { useQuery } from "@tanstack/react-query";
import listTaskTemplates from "@/fetchers/task-template/list-task-templates";

export function useGetTaskTemplates(projectId: string) {
  return useQuery({
    queryKey: ["task-templates", projectId],
    queryFn: () => listTaskTemplates(projectId),
    enabled: !!projectId,
  });
}
