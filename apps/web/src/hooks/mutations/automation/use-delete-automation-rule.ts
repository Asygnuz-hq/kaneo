import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteAutomationRule from "@/fetchers/automation/delete-automation-rule";

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      deleteAutomationRule(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", variables.projectId],
      });
    },
  });
}
