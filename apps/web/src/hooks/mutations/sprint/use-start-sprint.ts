import { useMutation, useQueryClient } from "@tanstack/react-query";
import startSprint from "@/fetchers/sprint/start-sprint";

export function useStartSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startSprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}
