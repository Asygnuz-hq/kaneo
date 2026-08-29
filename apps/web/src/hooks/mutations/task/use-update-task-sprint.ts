import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskSprint from "@/fetchers/task/update-task-sprint";

export function useUpdateTaskSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sprintId }: { id: string; sprintId: string | null }) =>
      updateTaskSprint(id, sprintId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
    },
  });
}
