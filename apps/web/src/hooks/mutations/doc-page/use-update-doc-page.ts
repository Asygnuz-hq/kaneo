import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateDocPage from "@/fetchers/doc-page/update-doc-page";

export default function useUpdateDocPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDocPage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["doc-pages"] });
      queryClient.invalidateQueries({ queryKey: ["doc-page", variables.id] });
    },
  });
}
