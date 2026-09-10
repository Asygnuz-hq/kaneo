import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskSpec from "@/fetchers/task/update-task-spec";
import type { RequirementSpec, StorySpec } from "@/types/task";

export function useUpdateTaskSpec() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      spec,
    }: {
      taskId: string;
      projectId: string;
      spec: RequirementSpec | StorySpec;
    }) => updateTaskSpec(taskId, spec),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.taskId],
      });
    },
  });
}
