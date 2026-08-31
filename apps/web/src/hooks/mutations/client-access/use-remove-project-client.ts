import { useMutation, useQueryClient } from "@tanstack/react-query";
import removeProjectClient from "@/fetchers/client-access/remove-project-client";

export function useRemoveProjectClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeProjectClient,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["client-access", variables.projectId],
      });
    },
  });
}
