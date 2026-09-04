import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTaskTemplate from "@/fetchers/task-template/create-task-template";

export function useCreateTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTaskTemplate,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-templates", variables.projectId],
      });
    },
  });
}
