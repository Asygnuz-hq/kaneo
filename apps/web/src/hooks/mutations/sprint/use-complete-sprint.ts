import { useMutation, useQueryClient } from "@tanstack/react-query";
import completeSprint from "@/fetchers/sprint/complete-sprint";

export function useCompleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeSprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
