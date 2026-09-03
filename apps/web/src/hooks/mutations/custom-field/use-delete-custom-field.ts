import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteCustomField from "@/fetchers/custom-field/delete-custom-field";

export default function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      queryClient.invalidateQueries({
        queryKey: ["task-custom-field-values"],
      });
    },
  });
}
