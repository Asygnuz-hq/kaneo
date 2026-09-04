import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskTemplate, {
  type UpdateTaskTemplateRequest,
} from "@/fetchers/task-template/update-task-template";

export function useUpdateTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId: _projectId,
      ...request
    }: UpdateTaskTemplateRequest & { projectId: string }) =>
      updateTaskTemplate(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-templates", variables.projectId],
      });
    },
  });
}
