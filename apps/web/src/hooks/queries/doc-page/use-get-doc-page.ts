import { useQuery } from "@tanstack/react-query";
import getDocPage from "@/fetchers/doc-page/get-doc-page";

export function useGetDocPage(id: string | null) {
  return useQuery({
    queryKey: ["doc-page", id],
    queryFn: () => getDocPage(id as string),
    enabled: !!id,
  });
}
