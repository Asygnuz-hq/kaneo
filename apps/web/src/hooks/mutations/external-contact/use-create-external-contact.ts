import { useMutation, useQueryClient } from "@tanstack/react-query";
import createExternalContact from "@/fetchers/external-contact/create-external-contact";

export default function useCreateExternalContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createExternalContact,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["external-contacts", variables.workspaceId],
      });
    },
  });
}
