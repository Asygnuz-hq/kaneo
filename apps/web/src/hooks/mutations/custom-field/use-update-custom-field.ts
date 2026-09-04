import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateCustomField from "@/fetchers/custom-field/update-custom-field";

export default function useUpdateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
    },
  });
}
