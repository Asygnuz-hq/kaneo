import { useQuery } from "@tanstack/react-query";
import listProjectClients from "@/fetchers/client-access/list-project-clients";

export function useGetProjectClients(projectId: string) {
  return useQuery({
    queryKey: ["client-access", projectId],
    queryFn: () => listProjectClients(projectId),
    enabled: !!projectId,
  });
}
