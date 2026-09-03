import { useMutation, useQueryClient } from "@tanstack/react-query";
import createCustomField from "@/fetchers/custom-field/create-custom-field";

export default function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomField,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["custom-fields", variables.workspaceId],
      });
    },
  });
}
