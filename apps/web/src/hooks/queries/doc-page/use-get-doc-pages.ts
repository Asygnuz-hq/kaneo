import { useQuery } from "@tanstack/react-query";
import listDocPages from "@/fetchers/doc-page/list-doc-pages";

export function useGetDocPages(projectId: string) {
  return useQuery({
    queryKey: ["doc-pages", projectId],
    queryFn: () => listDocPages(projectId),
    enabled: !!projectId,
  });
}
