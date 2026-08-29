import { useQuery } from "@tanstack/react-query";
import listSprints from "@/fetchers/sprint/list-sprints";

export function useGetSprints(projectId: string) {
  return useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => listSprints(projectId),
    enabled: !!projectId,
  });
}
