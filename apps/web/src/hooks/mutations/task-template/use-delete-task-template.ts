import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskTemplate from "@/fetchers/task-template/delete-task-template";

export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      deleteTaskTemplate(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-templates", variables.projectId],
      });
    },
  });
}
