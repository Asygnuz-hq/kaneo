import { useQuery } from "@tanstack/react-query";
import getProjectBlockingRelations from "@/fetchers/task-relation/get-project-blocking-relations";

function useGetProjectBlockingRelations(projectId: string) {
  return useQuery({
    queryKey: ["project-blocking-relations", projectId],
    queryFn: () => getProjectBlockingRelations(projectId),
    enabled: !!projectId,
  });
}

export default useGetProjectBlockingRelations;
