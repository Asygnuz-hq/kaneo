import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteExternalContact from "@/fetchers/external-contact/delete-external-contact";

export default function useDeleteExternalContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteExternalContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task"] });
    },
  });
}
