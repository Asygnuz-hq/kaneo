import { useQuery } from "@tanstack/react-query";
import getProjectSubtaskRelations from "@/fetchers/task-relation/get-project-subtask-relations";

function useGetProjectSubtaskRelations(projectId: string) {
  return useQuery({
    queryKey: ["project-subtask-relations", projectId],
    queryFn: () => getProjectSubtaskRelations(projectId),
    enabled: !!projectId,
  });
}

export default useGetProjectSubtaskRelations;
