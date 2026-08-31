import { useMutation, useQueryClient } from "@tanstack/react-query";
import inviteProjectClient from "@/fetchers/client-access/invite-project-client";

export function useInviteProjectClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteProjectClient,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["client-access", variables.projectId],
      });
    },
  });
}
