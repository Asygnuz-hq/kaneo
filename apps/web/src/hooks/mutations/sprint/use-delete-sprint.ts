import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteSprint from "@/fetchers/sprint/delete-sprint";

export function useDeleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
