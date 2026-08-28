import { useMutation, useQueryClient } from "@tanstack/react-query";
import createSprint from "@/fetchers/sprint/create-sprint";

export function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSprint,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["sprints", variables.projectId],
      });
    },
  });
}
