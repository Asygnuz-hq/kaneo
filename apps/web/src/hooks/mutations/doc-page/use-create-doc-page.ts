import { useMutation, useQueryClient } from "@tanstack/react-query";
import createDocPage from "@/fetchers/doc-page/create-doc-page";

export default function useCreateDocPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocPage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["doc-pages", variables.projectId],
      });
    },
  });
}
