import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteDocPage from "@/fetchers/doc-page/delete-doc-page";

export default function useDeleteDocPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-pages"] });
    },
  });
}
