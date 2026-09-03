import { useQuery } from "@tanstack/react-query";
import listCustomFields from "@/fetchers/custom-field/list-custom-fields";

export function useGetCustomFields(workspaceId: string) {
  return useQuery({
    queryKey: ["custom-fields", workspaceId],
    queryFn: () => listCustomFields(workspaceId),
    enabled: !!workspaceId,
  });
}
