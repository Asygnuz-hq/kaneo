import { useQuery } from "@tanstack/react-query";
import listExternalContacts from "@/fetchers/external-contact/list-external-contacts";

export function useGetExternalContacts(workspaceId: string) {
  return useQuery({
    queryKey: ["external-contacts", workspaceId],
    queryFn: () => listExternalContacts(workspaceId),
    enabled: !!workspaceId,
  });
}
