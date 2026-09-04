import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateAutomationRule, {
  type UpdateAutomationRuleRequest,
} from "@/fetchers/automation/update-automation-rule";

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId: _projectId,
      ...request
    }: UpdateAutomationRuleRequest & { projectId: string }) =>
      updateAutomationRule(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["automation-rules", variables.projectId],
      });
    },
  });
}
