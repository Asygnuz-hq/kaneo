import { useMutation, useQueryClient } from "@tanstack/react-query";
import unsetTaskCustomFieldValue from "@/fetchers/custom-field/unset-task-custom-field-value";

export default function useUnsetTaskCustomFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unsetTaskCustomFieldValue,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-custom-field-values", variables.taskId],
      });
    },
  });
}
