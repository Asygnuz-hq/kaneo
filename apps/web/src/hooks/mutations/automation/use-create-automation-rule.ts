import { useMutation, useQueryClient } from "@tanstack/react-query";
import createAutomationRule from "@/fetchers/automation/create-automation-rule";

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAutomationRule,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", variables.projectId],
      });
    },
  });
}
