import { useMutation, useQueryClient } from "@tanstack/react-query";
import setTaskCustomFieldValue from "@/fetchers/custom-field/set-task-custom-field-value";

export default function useSetTaskCustomFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setTaskCustomFieldValue,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-custom-field-values", variables.taskId],
      });
    },
  });
}
